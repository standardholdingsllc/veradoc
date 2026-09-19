#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const DEFAULTS = Object.freeze({
  appOrigin: "https://app.veradoc.pe",
  deploymentId: "dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51",
  chromePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  credentialFile: ".env.qa-test-credentials.local.md",
  credentialLabel: "qa-active-realtor",
  outputRoot: path.join(process.cwd(), "artifacts", "b5-expired-session"),
  timeoutMs: 45_000,
  expiryBufferMs: 15_000,
  maxWaitMs: 75 * 60_000,
});

const AUTH_COOKIE_PATTERN = /^(sb-.+-auth-token)(?:\.(\d+))?$/;
const EXPECTED_HEADING = "Panel del agente inmobiliario";

class BlockedEvidenceError extends Error {
  acceptanceStatus = "BLOCKED";
}

function envBoolean(value, fallback) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function sanitizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname.replace(
      /\/firma\/[^/]+/gi,
      "/firma/[token]",
    )}`;
  } catch {
    return String(rawUrl)
      .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=[redacted]")
      .replace(/\/firma\/[^/?\s]+/gi, "/firma/[token]");
  }
}

export function sanitizeText(value, maxLength = 2_000) {
  let text = String(value ?? "");
  text = text.replace(/https?:\/\/[^\s\"'<>]+/gi, (url) => sanitizeUrl(url));
  text = text
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[jwt-redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email-redacted]")
    .replace(/(password|access_token|refresh_token|authorization|cookie)(\s*[:=]\s*)[^\s,;}]+/gi, "$1$2[redacted]")
    .replace(/(sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?)(=)[^;\s]+/gi, "$1$2[redacted]");
  return text.length > maxLength ? `${text.slice(0, maxLength)}…[truncated]` : text;
}

function stripMarkdownCell(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function parseCredentialTable(markdown, label) {
  for (const line of String(markdown).split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map(stripMarkdownCell);
    if (cells[0] !== label) continue;
    if (!cells[1] || !cells[2]) {
      throw new BlockedEvidenceError(`Credential row ${label} is missing email or password fields.`);
    }
    return {
      email: cells[1],
      password: cells[2],
      role: cells[3] || null,
      status: cells[4] || null,
      canonicalLogin: cells[5] || null,
    };
  }
  throw new BlockedEvidenceError(`Credential row ${label} was not found.`);
}

function decodeBase64UrlJson(value, description) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error(`Could not decode ${description}; no token value was retained.`);
  }
}

export function decodeJwtPayload(token) {
  if (typeof token !== "string" || token.split(".").length !== 3) {
    throw new Error("The access token is not a three-segment JWT.");
  }
  return decodeBase64UrlJson(token.split(".")[1], "the JWT payload");
}

export function decodeSessionCookie(cookies) {
  const authCookies = cookies.filter((cookie) => AUTH_COOKIE_PATTERN.test(cookie.name));
  const bases = [...new Set(authCookies.map((cookie) => cookie.name.match(AUTH_COOKIE_PATTERN)?.[1]))]
    .filter(Boolean);
  if (bases.length !== 1) {
    throw new Error(`Expected one Supabase auth-cookie family; found ${bases.length}.`);
  }

  const baseName = bases[0];
  const unsplit = authCookies.find((cookie) => cookie.name === baseName);
  let encoded;
  if (unsplit) {
    encoded = unsplit.value;
  } else {
    const chunks = authCookies
      .filter((cookie) => cookie.name.startsWith(`${baseName}.`))
      .sort((a, b) => Number(a.name.split(".").at(-1)) - Number(b.name.split(".").at(-1)));
    if (chunks.length === 0 || chunks.some((cookie, index) => cookie.name !== `${baseName}.${index}`)) {
      throw new Error("The Supabase auth-cookie chunks are incomplete or non-contiguous.");
    }
    encoded = chunks.map((cookie) => cookie.value).join("");
  }

  let json = encoded;
  if (encoded.startsWith("base64-")) {
    try {
      json = Buffer.from(encoded.slice("base64-".length), "base64url").toString("utf8");
    } catch {
      throw new Error("The Supabase auth cookie could not be base64url decoded.");
    }
  }

  let session;
  try {
    session = JSON.parse(json);
  } catch {
    throw new Error("The Supabase auth cookie did not contain valid session JSON.");
  }
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error("The Supabase session is missing an access token or refresh token.");
  }
  return { baseName, authCookies, session, jwt: decodeJwtPayload(session.access_token) };
}

export function summarizeCookieAttributes(cookies) {
  return cookies
    .filter((cookie) => AUTH_COOKIE_PATTERN.test(cookie.name))
    .map((cookie) => ({
      name: cookie.name.replace(/^sb-.+-auth-token/, "sb-***-auth-token"),
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      httpOnly: cookie.httpOnly,
    }));
}

export function evaluateRefreshEvidence(evidence) {
  const materialRequestFailures = evidence.requestFailures.filter(
    (failure) => failure.error !== "net::ERR_ABORTED",
  );
  const checks = {
    serverIssuedTokenExpiredNaturally: evidence.fixtureProvenance === "server-issued-unmodified" && evidence.expiredBeforeRequest,
    sameHost: evidence.finalOrigin === evidence.expectedOrigin && evidence.allDocumentOriginsSameHost,
    protectedRouteRendered:
      evidence.finalPath === "/agente" &&
      evidence.finalHttpStatus === 200 &&
      evidence.heading === EXPECTED_HEADING,
    accessTokenRotated: evidence.accessTokenRotated === true,
    refreshTokenRotated: evidence.refreshTokenRotated === true,
    refreshedTokenValid:
      evidence.refreshedAccessExpiresAtEpoch > evidence.refreshCompletedAtEpoch + 300,
    identityPreserved: evidence.identityPreserved === true,
    secureHostOnlyCookies:
      evidence.cookieAttributes.length > 0 &&
      evidence.cookieAttributes.every(
        (cookie) =>
          cookie.secure === true &&
          cookie.sameSite === "Lax" &&
          cookie.domain === new URL(evidence.expectedOrigin).hostname &&
          !cookie.domain.startsWith("."),
      ),
    crossHostCookieCountZero: evidence.crossHostAuthCookieCount === 0,
    roleEnforced:
      evidence.wrongRoleAttemptFinalPath === "/agente" &&
      evidence.wrongRoleAttemptFinalOrigin === evidence.expectedOrigin,
    noRedirectLoop: evidence.redirectLoopDetected === false,
    noBrowserErrors:
      evidence.pageErrors.length === 0 &&
      materialRequestFailures.length === 0 &&
      evidence.http5xx.length === 0,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  return { status: failedChecks.length === 0 ? "PASS" : "FAIL", checks, failedChecks };
}

function publicCookieData(cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  };
}

function readConfig() {
  const origin = new URL(process.env.B5_APP_ORIGIN ?? DEFAULTS.appOrigin);
  if (origin.protocol !== "https:") {
    throw new BlockedEvidenceError("B5_APP_ORIGIN must use HTTPS.");
  }
  const timeoutMs = Number(process.env.B5_TIMEOUT_MS ?? DEFAULTS.timeoutMs);
  const expiryBufferMs = Number(process.env.B5_EXPIRY_BUFFER_MS ?? DEFAULTS.expiryBufferMs);
  const maxWaitMs = Number(process.env.B5_MAX_WAIT_MS ?? DEFAULTS.maxWaitMs);
  if (![timeoutMs, expiryBufferMs, maxWaitMs].every(Number.isFinite)) {
    throw new BlockedEvidenceError("B5 timing values must be finite numbers.");
  }
  return {
    appOrigin: origin.origin,
    deploymentId: process.env.B5_DEPLOYMENT_ID ?? DEFAULTS.deploymentId,
    chromePath: process.env.B5_CHROME_PATH ?? DEFAULTS.chromePath,
    credentialFile: process.env.B5_CREDENTIAL_FILE ?? DEFAULTS.credentialFile,
    credentialLabel: process.env.B5_CREDENTIAL_LABEL ?? DEFAULTS.credentialLabel,
    outputRoot: process.env.B5_OUTPUT_DIR ?? DEFAULTS.outputRoot,
    timeoutMs,
    expiryBufferMs,
    maxWaitMs,
    headless: !process.argv.includes("--headed") && envBoolean(process.env.B5_HEADLESS, true),
    email: process.env.B5_APP_EMAIL,
    password: process.env.B5_APP_PASSWORD,
  };
}

async function loadCredentials(config) {
  if (config.email && config.password) {
    return { email: config.email, password: config.password, source: "environment" };
  }
  let markdown;
  try {
    markdown = await readFile(path.resolve(config.credentialFile), "utf8");
  } catch {
    throw new BlockedEvidenceError(
      "B5 credentials are unavailable: set B5_APP_EMAIL/B5_APP_PASSWORD or provide the ignored QA credential table.",
    );
  }
  const row = parseCredentialTable(markdown, config.credentialLabel);
  if (row.role && row.role !== "realtor") {
    throw new BlockedEvidenceError("The selected B5 credential row is not the realtor fixture.");
  }
  if (row.status && row.status !== "active") {
    throw new BlockedEvidenceError("The selected B5 credential row is not active.");
  }
  return { email: row.email, password: row.password, source: "ignored-local-fixture" };
}

function attachPageEvidence(page, evidence) {
  page.on("console", (message) => {
    if (["error", "warning", "warn"].includes(message.type())) {
      evidence.console.push({ type: message.type(), text: sanitizeText(message.text()) });
    }
  });
  page.on("pageerror", (error) => evidence.pageErrors.push(sanitizeText(error?.stack ?? error)));
  page.on("requestfailed", (request) => {
    evidence.requestFailures.push({
      method: request.method(),
      route: sanitizeUrl(request.url()),
      error: sanitizeText(request.failure()?.errorText ?? "Unknown request failure"),
      navigationRequest: request.isNavigationRequest(),
      resourceType: request.resourceType(),
    });
  });
  page.on("response", (response) => {
    const request = response.request();
    if (response.status() >= 500) {
      evidence.http5xx.push({ status: response.status(), method: request.method(), route: sanitizeUrl(response.url()) });
    }
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      const route = sanitizeUrl(response.url());
      evidence.documentResponses.push({ status: response.status(), route, utc: new Date().toISOString() });
      try {
        const setCookie = response.headers()["set-cookie"] ?? "";
        if (/sb-[A-Za-z0-9_-]+-auth-token/.test(setCookie)) {
          evidence.authSetCookieObserved = true;
        }
      } catch {
        // Cookie rotation is independently verified from the browser store.
      }
    }
  });
}

async function waitForLoginExit(page, timeoutMs) {
  try {
    await page.waitForFunction(
      () => window.location.pathname !== "/auth/login",
      { timeout: timeoutMs },
    );
  } catch (error) {
    const alert = await page.$eval('[role="alert"]', (node) => node.textContent).catch(() => null);
    throw new BlockedEvidenceError(
      `QA login did not leave /auth/login. ${alert ? `Visible alert: ${sanitizeText(alert)}` : "No visible alert."}`,
      { cause: error },
    );
  }
}

async function createFixture(browser, config, credentials, contextNumber) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeoutMs);
  page.setDefaultNavigationTimeout(config.timeoutMs);
  await page.setViewport({ width: 1280, height: 720 });
  try {
    const loginResponse = await page.goto(`${config.appOrigin}/auth/login`, { waitUntil: "networkidle2" });
    if (!loginResponse?.ok()) {
      throw new BlockedEvidenceError(`Login document returned HTTP ${loginResponse?.status() ?? "unknown"}.`);
    }
    await page.type("#email", credentials.email);
    await page.type("#password", credentials.password);
    await page.click('button[type="submit"]');
    await waitForLoginExit(page, config.timeoutMs);
    if (new URL(page.url()).origin !== config.appOrigin || new URL(page.url()).pathname !== "/agente") {
      throw new BlockedEvidenceError(`Expected the realtor dashboard but reached ${sanitizeUrl(page.url())}.`);
    }

    const cookies = await page.cookies(config.appOrigin);
    const decoded = decodeSessionCookie(cookies);
    const role = decoded.session.user?.app_metadata?.role ?? decoded.jwt.app_metadata?.role;
    const status = decoded.session.user?.app_metadata?.status ?? decoded.jwt.app_metadata?.status;
    if (role !== "realtor" || status !== "active") {
      throw new BlockedEvidenceError("The authenticated QA session is not an active realtor session.");
    }
    const expiryEpoch = Number(decoded.jwt.exp);
    if (!Number.isFinite(expiryEpoch) || expiryEpoch * 1_000 <= Date.now()) {
      throw new BlockedEvidenceError("The freshly issued access token does not have a future expiry.");
    }
    return {
      contextNumber,
      cookieData: cookies.map(publicCookieData),
      authCookieCount: decoded.authCookies.length,
      accessToken: decoded.session.access_token,
      refreshToken: decoded.session.refresh_token,
      subject: decoded.session.user?.id ?? decoded.jwt.sub,
      expiryEpoch,
      expiryUtc: new Date(expiryEpoch * 1_000).toISOString(),
      issuedAtUtc: new Date().toISOString(),
    };
  } finally {
    await context.close();
  }
}

function hasRedirectLoop(documentResponses) {
  const redirects = documentResponses.filter((entry) => entry.status >= 300 && entry.status < 400);
  if (redirects.length > 6) return true;
  const counts = new Map();
  for (const entry of redirects) counts.set(entry.route, (counts.get(entry.route) ?? 0) + 1);
  return [...counts.values()].some((count) => count > 2);
}

async function exerciseExpiredFixture(browser, config, fixture) {
  const startedAtUtc = new Date().toISOString();
  const evidence = {
    contextNumber: fixture.contextNumber,
    startedAtUtc,
    fixtureIssuedAtUtc: fixture.issuedAtUtc,
    originalAccessExpiresAtUtc: fixture.expiryUtc,
    fixtureProvenance: "server-issued-unmodified",
    expectedOrigin: config.appOrigin,
    expiredBeforeRequest: Date.now() > fixture.expiryEpoch * 1_000,
    console: [],
    pageErrors: [],
    requestFailures: [],
    http5xx: [],
    documentResponses: [],
    authSetCookieObserved: false,
    status: "FAIL",
  };
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeoutMs);
  page.setDefaultNavigationTimeout(config.timeoutMs);
  await page.setViewport({ width: 1280, height: 720 });
  attachPageEvidence(page, evidence);

  try {
    await context.setCookie(...fixture.cookieData);
    const response = await page.goto(`${config.appOrigin}/agente`, { waitUntil: "networkidle2" });
    evidence.refreshCompletedAtUtc = new Date().toISOString();
    evidence.refreshCompletedAtEpoch = Math.floor(Date.now() / 1_000);
    evidence.finalHttpStatus = response?.status() ?? null;
    evidence.finalRoute = sanitizeUrl(page.url());
    evidence.finalOrigin = new URL(page.url()).origin;
    evidence.finalPath = new URL(page.url()).pathname;
    evidence.heading = sanitizeText(
      await page.$eval("h1", (node) => node.textContent?.trim() ?? "").catch(() => ""),
    );

    const afterRefreshCookies = await page.cookies(config.appOrigin);
    const decoded = decodeSessionCookie(afterRefreshCookies);
    evidence.accessTokenRotated = decoded.session.access_token !== fixture.accessToken;
    evidence.refreshTokenRotated = decoded.session.refresh_token !== fixture.refreshToken;
    evidence.identityPreserved = (decoded.session.user?.id ?? decoded.jwt.sub) === fixture.subject;
    evidence.refreshedAccessExpiresAtEpoch = Number(decoded.jwt.exp);
    evidence.refreshedAccessExpiresAtUtc = Number.isFinite(evidence.refreshedAccessExpiresAtEpoch)
      ? new Date(evidence.refreshedAccessExpiresAtEpoch * 1_000).toISOString()
      : null;
    evidence.authCookieCountBefore = fixture.authCookieCount;
    evidence.authCookieCountAfter = decoded.authCookies.length;
    evidence.cookieAttributes = summarizeCookieAttributes(afterRefreshCookies);

    const wrongRoleResponse = await page.goto(`${config.appOrigin}/arrendador`, { waitUntil: "networkidle2" });
    evidence.wrongRoleAttemptHttpStatus = wrongRoleResponse?.status() ?? null;
    evidence.wrongRoleAttemptFinalRoute = sanitizeUrl(page.url());
    evidence.wrongRoleAttemptFinalOrigin = new URL(page.url()).origin;
    evidence.wrongRoleAttemptFinalPath = new URL(page.url()).pathname;

    // BrowserContext.cookies(url) returns the whole context store in the
    // installed Puppeteer release. CDP's Network.getCookies performs the URL
    // applicability check we need for host-only-cookie evidence.
    const cdp = await page.createCDPSession();
    const crossHostCookies = await cdp.send("Network.getCookies", {
      urls: ["https://admin.veradoc.pe/"],
    });
    evidence.crossHostAuthCookieCount = crossHostCookies.cookies.filter((cookie) =>
      AUTH_COOKIE_PATTERN.test(cookie.name),
    ).length;
    evidence.allDocumentOriginsSameHost = evidence.documentResponses.every(
      (entry) => new URL(entry.route).origin === config.appOrigin,
    );
    evidence.redirectLoopDetected = hasRedirectLoop(evidence.documentResponses);
    evidence.completedAtUtc = new Date().toISOString();
    const verdict = evaluateRefreshEvidence(evidence);
    evidence.status = verdict.status;
    evidence.checks = verdict.checks;
    evidence.failedChecks = verdict.failedChecks;
    return evidence;
  } catch (error) {
    evidence.status = error?.acceptanceStatus ?? "FAIL";
    evidence.completedAtUtc = new Date().toISOString();
    evidence.finalRoute = sanitizeUrl(page.url());
    evidence.error = sanitizeText(error?.stack ?? error);
    return evidence;
  } finally {
    await context.close();
  }
}

function makeFailure(report, context) {
  const blocked = context?.status === "BLOCKED" || report.overallStatus === "BLOCKED";
  return {
    id: `B5-EXPIRED-REFRESHABLE-CONTEXT-${context?.contextNumber ?? "SETUP"}`,
    status: context?.status ?? report.overallStatus,
    severity: blocked ? "Medium" : "High",
    title: blocked
      ? "Expired-session authentication evidence unavailable"
      : "Expired-but-refreshable session acceptance failed",
    reproductionSteps: [
      "Launch standalone Chrome with a new browser context and authenticate the dedicated active realtor on https://app.veradoc.pe/auth/login.",
      "Capture the server-issued session cookies in process memory without logging their values; close the context without modifying the token.",
      "Wait until the JWT exp time plus the configured safety buffer, proving natural expiry while the refresh token remains unused.",
      "Open another new browser context, restore that context's own cookies, and navigate directly to https://app.veradoc.pe/agente.",
      "Verify same-host protected rendering, access- and refresh-token rotation, a future JWT expiry, preserved identity, Secure host-only SameSite=Lax cookies, and no redirect loop.",
      "Navigate to https://app.veradoc.pe/arrendador and verify the realtor is returned to /agente; repeat with a second independently authenticated clean context.",
    ],
    expectedBehavior:
      "Both naturally expired, independently issued sessions refresh on app.veradoc.pe, rotate both tokens, retain secure host-only cookies, render /agente, enforce the realtor role, and avoid loops or cross-host cookies.",
    actualBehavior: context
      ? `Context ${context.contextNumber} status ${context.status}; failed checks: ${(context.failedChecks ?? []).join(", ") || "unavailable"}.`
      : report.setupError ?? "The acceptance run could not start.",
    exactRouteAndUtc: {
      route: context?.finalRoute ?? `${report.config.appOrigin}/agente`,
      utc: context?.completedAtUtc ?? report.runCompletedAtUtc,
    },
    deploymentId: report.config.deploymentId,
    sanitizedErrorOrStack: context?.error ?? report.setupError ?? "No stack was available.",
    likelyFailingLayer: blocked
      ? "QA credential fixture, local Chrome/Puppeteer setup, or the natural-expiry evidence window"
      : "Supabase SSR refresh, Proxy Set-Cookie preservation, host routing, or role enforcement",
    reproducesInSecondCleanContext:
      report.contexts.length >= 2
        ? `Context 1 ${report.contexts[0].status}; context 2 ${report.contexts[1].status}`
        : "NOT RUN",
    recommendedNextDiagnostic: blocked
      ? "Restore the missing local fixture/Chrome prerequisite and rerun; do not substitute a mutated or unsigned JWT and do not claim PASS."
      : "Correlate the exact UTC with sanitized Vercel and Supabase Auth logs, then inspect whether the protected navigation returned all Set-Cookie chunks before the role redirect.",
  };
}

function markdownReport(report) {
  const lines = [
    "# B5 expired-but-refreshable session acceptance result",
    "",
    `Overall: **${report.overallStatus}**`,
    "",
    `- Run UTC: ${report.runStartedAtUtc}–${report.runCompletedAtUtc}`,
    `- Deployment ID: \`${report.config.deploymentId}\``,
    `- App origin: \`${report.config.appOrigin}\``,
    `- Browser: ${report.browser ?? "unavailable"}`,
    `- Fixture: two independently authenticated, server-issued, unmodified access tokens allowed to expire naturally`,
    `- Credential source: ${report.credentialSource ?? "unavailable"}; values were never printed or written`,
    "",
    "## Context evidence",
    "",
  ];
  if (report.contexts.length === 0) {
    lines.push("No browser context completed.");
  } else {
    for (const context of report.contexts) {
      lines.push(
        `### Context ${context.contextNumber} — ${context.status}`,
        "",
        `- Fixture issued UTC: ${context.fixtureIssuedAtUtc}`,
        `- Original access-token expiry UTC: ${context.originalAccessExpiresAtUtc}`,
        `- Refresh request window UTC: ${context.startedAtUtc}–${context.refreshCompletedAtUtc ?? context.completedAtUtc}`,
        `- Exact final route: \`${context.finalRoute ?? "unavailable"}\` (HTTP ${context.finalHttpStatus ?? "unavailable"})`,
        `- Natural expiry proven: ${context.checks?.serverIssuedTokenExpiredNaturally === true ? "yes" : "no"}`,
        `- Access token rotated: ${context.accessTokenRotated === true ? "yes" : "no"}`,
        `- Refresh token rotated: ${context.refreshTokenRotated === true ? "yes" : "no"}`,
        `- New access-token expiry UTC: ${context.refreshedAccessExpiresAtUtc ?? "unavailable"}`,
        `- Identity preserved: ${context.identityPreserved === true ? "yes" : "no"}`,
        `- Cookie chunks before/after: ${context.authCookieCountBefore ?? "unavailable"}/${context.authCookieCountAfter ?? "unavailable"}`,
        `- Auth Set-Cookie visible to browser instrumentation: ${context.authSetCookieObserved ? "yes" : "not exposed by instrumentation; rotation verified from cookie store"}`,
        `- Secure host-only SameSite=Lax cookies: ${context.checks?.secureHostOnlyCookies === true ? "yes" : "no"}`,
        `- Admin-host auth-cookie count: ${context.crossHostAuthCookieCount ?? "unavailable"}`,
        `- Wrong-role attempt final route: \`${context.wrongRoleAttemptFinalRoute ?? "unavailable"}\``,
        `- Redirect loop detected: ${context.redirectLoopDetected === true ? "yes" : "no"}`,
        `- Browser page errors / failed requests / benign ERR_ABORTED cancellations / HTTP 5xx: ${context.pageErrors?.length ?? 0} / ${(context.requestFailures ?? []).filter((failure) => failure.error !== "net::ERR_ABORTED").length} / ${(context.requestFailures ?? []).filter((failure) => failure.error === "net::ERR_ABORTED").length} / ${context.http5xx?.length ?? 0}`,
        "",
      );
    }
  }

  lines.push("## Failures and blockers", "");
  if (report.failures.length === 0) {
    lines.push("None.");
  } else {
    for (const failure of report.failures) {
      lines.push(
        `### ${failure.id} — ${failure.status}`,
        "",
        `- Severity: ${failure.severity}`,
        `- Expected: ${failure.expectedBehavior}`,
        `- Actual: ${failure.actualBehavior}`,
        `- Exact route and UTC: \`${failure.exactRouteAndUtc.route}\` at \`${failure.exactRouteAndUtc.utc}\``,
        `- Deployment ID: \`${failure.deploymentId}\``,
        `- Sanitized error or stack: \`${sanitizeText(failure.sanitizedErrorOrStack).replace(/`/g, "'")}\``,
        `- Likely failing layer: ${failure.likelyFailingLayer}`,
        `- Second clean context: ${failure.reproducesInSecondCleanContext}`,
        `- Recommended next diagnostic: ${failure.recommendedNextDiagnostic}`,
        "- Exact reproduction steps:",
      );
      failure.reproductionSteps.forEach((step, index) => lines.push(`  ${index + 1}. ${step}`));
      lines.push("");
    }
  }
  lines.push(
    "## Verdict rule",
    "",
    "PASS requires both independently authenticated clean contexts to use an unmodified server-issued access token after its real exp time; rotate both access and refresh tokens; produce a future access-token expiry; preserve identity; render the protected realtor dashboard on the same host; preserve Secure, host-only, SameSite=Lax cookies; leak zero auth cookies to admin.veradoc.pe; enforce the realtor role; and show no redirect loop, failed request, page error, or HTTP 5xx. Missing authentication evidence or an unavailable second clean context is BLOCKED, never PASS.",
    "",
  );
  return lines.join("\n");
}

function determineOverall(contexts) {
  if (contexts.length !== 2) return "BLOCKED";
  if (contexts.some((context) => context.status === "FAIL")) return "FAIL";
  if (contexts.some((context) => context.status === "BLOCKED")) return "BLOCKED";
  return contexts.every((context) => context.status === "PASS") ? "PASS" : "PARTIAL";
}

function printHelp() {
  console.log(`Usage: npm run test:b5-expired-session [-- --headed]

Credentials are read from B5_APP_EMAIL/B5_APP_PASSWORD or, by default, the
git-ignored ${DEFAULTS.credentialFile} row ${DEFAULTS.credentialLabel}.
Values are held in memory only and are never printed or written.

Optional:
  B5_APP_ORIGIN          Default: ${DEFAULTS.appOrigin}
  B5_DEPLOYMENT_ID       Default: ${DEFAULTS.deploymentId}
  B5_CHROME_PATH         Default: ${DEFAULTS.chromePath}
  B5_CREDENTIAL_FILE     Default: ${DEFAULTS.credentialFile}
  B5_CREDENTIAL_LABEL    Default: ${DEFAULTS.credentialLabel}
  B5_OUTPUT_DIR          Default: artifacts/b5-expired-session
  B5_TIMEOUT_MS          Default: ${DEFAULTS.timeoutMs}
  B5_EXPIRY_BUFFER_MS    Default: ${DEFAULTS.expiryBufferMs}
  B5_MAX_WAIT_MS         Default: ${DEFAULTS.maxWaitMs}

This is intentionally a long-running test: it waits for two real server-issued
access tokens to expire. It does not mutate JWTs or production account data.`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  const runStartedAtUtc = new Date().toISOString();
  let config;
  try {
    config = readConfig();
  } catch (error) {
    console.error(`BLOCKED: ${sanitizeText(error?.message ?? error)}`);
    process.exitCode = 2;
    return;
  }
  const publicConfig = {
    appOrigin: config.appOrigin,
    deploymentId: config.deploymentId,
    chromePath: config.chromePath,
    headless: config.headless,
    expiryBufferMs: config.expiryBufferMs,
    maxWaitMs: config.maxWaitMs,
  };
  const report = {
    schemaVersion: 1,
    runStartedAtUtc,
    runCompletedAtUtc: runStartedAtUtc,
    config: publicConfig,
    contexts: [],
    overallStatus: "BLOCKED",
    failures: [],
  };

  let browser;
  try {
    await access(config.chromePath, fsConstants.F_OK);
    const credentials = await loadCredentials(config);
    report.credentialSource = credentials.source;
    browser = await puppeteer.launch({
      executablePath: config.chromePath,
      headless: config.headless,
      args: ["--no-first-run", "--disable-background-networking"],
    });
    report.browser = await browser.version();

    const fixtures = [];
    for (let contextNumber = 1; contextNumber <= 2; contextNumber += 1) {
      fixtures.push(await createFixture(browser, config, credentials, contextNumber));
    }
    await browser.close();
    browser = null;

    const readyAtMs = Math.max(...fixtures.map((fixture) => fixture.expiryEpoch * 1_000)) + config.expiryBufferMs;
    const waitMs = Math.max(0, readyAtMs - Date.now());
    if (waitMs > config.maxWaitMs) {
      throw new BlockedEvidenceError(
        `Natural token expiry requires ${Math.ceil(waitMs / 60_000)} minutes, above B5_MAX_WAIT_MS.`,
      );
    }
    report.fixtureSummary = fixtures.map((fixture) => ({
      contextNumber: fixture.contextNumber,
      issuedAtUtc: fixture.issuedAtUtc,
      expiryUtc: fixture.expiryUtc,
      authCookieCount: fixture.authCookieCount,
    }));
    console.log(`B5 fixtures ready. Waiting ${Math.ceil(waitMs / 1_000)} seconds for genuine access-token expiry.`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    browser = await puppeteer.launch({
      executablePath: config.chromePath,
      headless: config.headless,
      args: ["--no-first-run", "--disable-background-networking"],
    });
    for (const fixture of fixtures) {
      report.contexts.push(await exerciseExpiredFixture(browser, config, fixture));
    }
    report.overallStatus = determineOverall(report.contexts);
  } catch (error) {
    report.setupError = sanitizeText(error?.stack ?? error);
    report.overallStatus = error?.acceptanceStatus ?? "BLOCKED";
  } finally {
    await browser?.close();
  }

  report.runCompletedAtUtc = new Date().toISOString();
  if (report.overallStatus !== "PASS") {
    const failedContexts = report.contexts.filter((context) => context.status !== "PASS");
    report.failures = failedContexts.length > 0
      ? failedContexts.map((context) => makeFailure(report, context))
      : [makeFailure(report, null)];
  }

  const runDirectory = path.join(config.outputRoot, runStartedAtUtc.replace(/[:.]/g, "-"));
  await mkdir(runDirectory, { recursive: true });
  await writeFile(path.join(runDirectory, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(runDirectory, "report.md"), markdownReport(report));
  console.log(`B5 expired-session acceptance: ${report.overallStatus}`);
  console.log(`Sanitized report: ${path.join(runDirectory, "report.md")}`);
  process.exitCode = report.overallStatus === "PASS" ? 0 : report.overallStatus === "FAIL" ? 1 : 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await main();
}
