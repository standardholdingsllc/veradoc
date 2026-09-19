#!/usr/bin/env node

import { access, mkdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const DEFAULTS = Object.freeze({
  startUtc: "2026-09-17T05:53:09.000Z",
  endUtc: "2026-09-17T05:53:34.000Z",
  deploymentId: "dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51",
  projectRef: "fyfcslzgahfbyezsnpxl",
  notaryOrigin: "https://notario.veradoc.pe",
  chromePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  timeoutMs: 45_000,
});

const PAYOUT_ROUTE = "/rest/v1/notary_payout_rates";
const ACCOUNTING_UNAVAILABLE =
  "El resumen de ganancias estará disponible cuando finalice la habilitación del módulo contable.";

class AuthenticationEvidenceError extends Error {
  acceptanceStatus = "BLOCKED";
}

function envBoolean(value, fallback) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function requireIsoUtc(value, name) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new Error(`${name} must be an ISO-8601 UTC timestamp ending in Z.`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} is not a valid timestamp.`);
  return new Date(parsed).toISOString();
}

function readConfig() {
  const startUtc = requireIsoUtc(
    process.env.H1_START_UTC ?? DEFAULTS.startUtc,
    "H1_START_UTC",
  );
  const endUtc = requireIsoUtc(
    process.env.H1_END_UTC ?? DEFAULTS.endUtc,
    "H1_END_UTC",
  );
  if (Date.parse(endUtc) <= Date.parse(startUtc)) {
    throw new Error("H1_END_UTC must be later than H1_START_UTC.");
  }
  if (Date.parse(endUtc) - Date.parse(startUtc) > 86_400_000) {
    throw new Error("The Supabase log window cannot exceed 24 hours.");
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF ?? DEFAULTS.projectRef;
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF must be a 20-character lowercase project ref.");
  }

  const notaryOrigin = new URL(
    process.env.H1_NOTARY_ORIGIN ?? DEFAULTS.notaryOrigin,
  );
  if (notaryOrigin.protocol !== "https:") {
    throw new Error("H1_NOTARY_ORIGIN must use HTTPS.");
  }

  return {
    startUtc,
    endUtc,
    deploymentId: process.env.H1_DEPLOYMENT_ID ?? DEFAULTS.deploymentId,
    projectRef,
    notaryOrigin: notaryOrigin.origin,
    chromePath: process.env.H1_CHROME_PATH ?? DEFAULTS.chromePath,
    headless: !process.argv.includes("--headed") && envBoolean(process.env.H1_HEADLESS, true),
    timeoutMs: Number(process.env.H1_TIMEOUT_MS ?? DEFAULTS.timeoutMs),
    outputRoot:
      process.env.H1_OUTPUT_DIR ?? path.join(process.cwd(), "artifacts", "h1-telemetry"),
    supabaseAccessToken: process.env.SUPABASE_ACCESS_TOKEN,
    notaryEmail: process.env.H1_NOTARY_EMAIL,
    notaryPassword: process.env.H1_NOTARY_PASSWORD,
  };
}

export function sanitizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.replace(
      /\/firma\/[^/]+/gi,
      "/firma/[token]",
    );
    return `${url.origin}${pathname}`;
  } catch {
    return String(rawUrl)
      .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=[redacted]")
      .replace(/\/firma\/[^/?\s]+/gi, "/firma/[token]");
  }
}

export function sanitizeText(value, maxLength = 2_000) {
  let text = String(value ?? "");
  text = text.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => sanitizeUrl(url));
  text = text
    .replace(
      /(authorization)(\s*[:=]\s*)(?:Bearer\s+)?[^\s,;}]+/gi,
      "$1$2[redacted]",
    )
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[jwt-redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email-redacted]")
    .replace(/(password|passwd|access_token|refresh_token|cookie)(\s*[:=]\s*)[^\s,;}]+/gi, "$1$2[redacted]")
    .replace(/(sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?)(=)[^;\s]+/gi, "$1$2[redacted]")
    .replace(/\/firma\/[^/?\s]+/gi, "/firma/[token]");
  return text.length > maxLength ? `${text.slice(0, maxLength)}…[truncated]` : text;
}

function sqlTimestamp(isoUtc) {
  // requireIsoUtc has already reduced this to a fixed character allowlist.
  return `parseDateTime64BestEffort('${isoUtc}')`;
}

export function buildTelemetrySql(startUtc, endUtc) {
  return `select
  count() as total_edge_rows,
  countIf(position(log_attributes['request.path'], '${PAYOUT_ROUTE}') > 0) as payout_request_count,
  countIf(
    position(log_attributes['request.path'], '${PAYOUT_ROUTE}') > 0
    and toInt32OrZero(log_attributes['response.status_code']) = 400
  ) as payout_400_count,
  min(timestamp) as first_event_utc,
  max(timestamp) as last_event_utc
from logs
where source = 'edge_logs'
  and timestamp >= ${sqlTimestamp(startUtc)}
  and timestamp <= ${sqlTimestamp(endUtc)}`;
}

function numericCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function evaluateTelemetryRow(row) {
  const totalEdgeRows = numericCount(row?.total_edge_rows);
  const payoutRequestCount = numericCount(row?.payout_request_count);
  const payout400Count = numericCount(row?.payout_400_count);

  if ([totalEdgeRows, payoutRequestCount, payout400Count].includes(null)) {
    return {
      status: "BLOCKED",
      reason: "The Supabase response did not contain valid aggregate counters.",
    };
  }
  if (totalEdgeRows === 0) {
    return {
      status: "PARTIAL",
      reason:
        "The query returned zero edge-log rows for the exact window, so retention/source coverage is not proven.",
      totals: { totalEdgeRows, payoutRequestCount, payout400Count },
    };
  }
  if (payout400Count > 0) {
    return {
      status: "FAIL",
      reason: `Found ${payout400Count} HTTP 400 payout-rate request(s).`,
      totals: { totalEdgeRows, payoutRequestCount, payout400Count },
    };
  }
  if (payoutRequestCount > 0) {
    return {
      status: "FAIL",
      reason: `Found ${payoutRequestCount} payout-rate request(s); the disabled gate should issue zero.`,
      totals: { totalEdgeRows, payoutRequestCount, payout400Count },
    };
  }
  return {
    status: "PASS",
    reason: "Authenticated telemetry has coverage and both payout-rate counters are zero.",
    totals: { totalEdgeRows, payoutRequestCount, payout400Count },
  };
}

function makeFailure({
  id,
  status = "FAIL",
  severity,
  title,
  reproductionSteps,
  expectedBehavior,
  actualBehavior,
  route,
  utc,
  deploymentId,
  error,
  likelyFailingLayer,
  secondCleanContext,
  recommendedNextDiagnostic,
}) {
  return {
    id,
    status,
    severity,
    title,
    reproductionSteps,
    expectedBehavior,
    actualBehavior: sanitizeText(actualBehavior),
    exactRouteAndUtc: { route: sanitizeUrl(route), utc },
    deploymentId,
    sanitizedErrorOrStack: sanitizeText(error || "No stack was available."),
    likelyFailingLayer,
    reproducesInSecondCleanContext: secondCleanContext,
    recommendedNextDiagnostic,
  };
}

async function queryTelemetry(config) {
  const checkedAtUtc = new Date().toISOString();
  if (!config.supabaseAccessToken) {
    return {
      status: "BLOCKED",
      checkedAtUtc,
      authenticated: false,
      reason:
        "SUPABASE_ACCESS_TOKEN is missing; authenticated database telemetry is unavailable.",
    };
  }

  const endpoint = new URL(
    `https://api.supabase.com/v1/projects/${config.projectRef}/analytics/endpoints/logs`,
  );
  endpoint.searchParams.set("sql", buildTelemetrySql(config.startUtc, config.endUtc));
  endpoint.searchParams.set("iso_timestamp_start", config.startUtc);
  endpoint.searchParams.set("iso_timestamp_end", config.endUtc);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.supabaseAccessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    return {
      status: "BLOCKED",
      checkedAtUtc,
      authenticated: false,
      reason: "The Supabase Logs API request did not complete.",
      error: sanitizeText(error?.stack ?? error),
    };
  }

  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return {
      status: "BLOCKED",
      checkedAtUtc,
      authenticated: response.ok,
      httpStatus: response.status,
      reason: "The Supabase Logs API returned a non-JSON response.",
      error: sanitizeText(bodyText),
    };
  }

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "BLOCKED" : "PARTIAL",
      checkedAtUtc,
      authenticated: false,
      httpStatus: response.status,
      reason: `The Supabase Logs API returned HTTP ${response.status}.`,
      error: sanitizeText(body?.message ?? body?.error ?? bodyText),
    };
  }
  if (body?.error) {
    return {
      status: "BLOCKED",
      checkedAtUtc,
      authenticated: true,
      httpStatus: response.status,
      reason: "The authenticated Supabase log query returned a query error.",
      error: sanitizeText(body.error),
    };
  }
  if (!Array.isArray(body?.result) || body.result.length !== 1) {
    return {
      status: "BLOCKED",
      checkedAtUtc,
      authenticated: true,
      httpStatus: response.status,
      reason: "The authenticated Supabase response had an unexpected result shape.",
      error: `Expected one aggregate row; received ${Array.isArray(body?.result) ? body.result.length : "non-array"}.`,
    };
  }

  return {
    ...evaluateTelemetryRow(body.result[0]),
    checkedAtUtc,
    authenticated: true,
    httpStatus: response.status,
    firstEventUtc: body.result[0].first_event_utc ?? null,
    lastEventUtc: body.result[0].last_event_utc ?? null,
  };
}

function attachPageEvidence(page, evidence) {
  page.on("console", (message) => {
    if (["error", "warning", "warn"].includes(message.type())) {
      evidence.console.push({ type: message.type(), text: sanitizeText(message.text()) });
    }
  });
  page.on("pageerror", (error) => {
    evidence.pageErrors.push(sanitizeText(error?.stack ?? error));
  });
  page.on("requestfailed", (request) => {
    evidence.requestFailures.push({
      method: request.method(),
      route: sanitizeUrl(request.url()),
      error: sanitizeText(request.failure()?.errorText ?? "Unknown request failure"),
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      evidence.httpErrors.push({
        status: response.status(),
        route: sanitizeUrl(response.url()),
        method: response.request().method(),
      });
    }
  });
}

async function waitForPathChange(page, originalPath, timeoutMs) {
  await page.waitForFunction(
    (pathToLeave) => window.location.pathname !== pathToLeave,
    { timeout: timeoutMs },
    originalPath,
  );
}

async function runBrowserContext(browser, config, contextNumber) {
  const startedAtUtc = new Date().toISOString();
  const evidence = {
    contextNumber,
    startedAtUtc,
    status: "FAIL",
    console: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
  };
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeoutMs);
  page.setDefaultNavigationTimeout(config.timeoutMs);
  await page.setViewport({ width: 1280, height: 720 });
  attachPageEvidence(page, evidence);

  try {
    const loginUrl = `${config.notaryOrigin}/auth/login`;
    const loginResponse = await page.goto(loginUrl, { waitUntil: "networkidle2" });
    evidence.loginHttpStatus = loginResponse?.status() ?? null;
    if (!loginResponse?.ok()) {
      throw new Error(`Login document returned HTTP ${loginResponse?.status() ?? "unknown"}.`);
    }
    await page.waitForSelector("#email");
    await page.waitForSelector("#password");
    await page.type("#email", config.notaryEmail);
    await page.type("#password", config.notaryPassword);
    await page.click('button[type="submit"]');

    try {
      await waitForPathChange(page, "/auth/login", config.timeoutMs);
    } catch (error) {
      const alert = await page.$eval('[role="alert"]', (node) => node.textContent).catch(() => null);
      throw new AuthenticationEvidenceError(
        `Login did not leave /auth/login. ${alert ? `Visible alert: ${alert}` : "No visible alert."}`,
        { cause: error },
      );
    }

    evidence.postLoginRoute = sanitizeUrl(page.url());
    if (new URL(page.url()).origin !== config.notaryOrigin) {
      throw new Error(`Login left the notary origin: ${sanitizeUrl(page.url())}`);
    }

    const earningsUrl = `${config.notaryOrigin}/ganancias`;
    const earningsResponse = await page.goto(earningsUrl, { waitUntil: "networkidle2" });
    evidence.earningsHttpStatus = earningsResponse?.status() ?? null;
    evidence.finalRoute = sanitizeUrl(page.url());
    if (!earningsResponse?.ok()) {
      throw new Error(`Earnings document returned HTTP ${earningsResponse?.status() ?? "unknown"}.`);
    }
    if (new URL(page.url()).pathname !== "/ganancias") {
      throw new Error(`Expected /ganancias but reached ${sanitizeUrl(page.url())}.`);
    }

    const heading = await page.$eval("h1", (node) => node.textContent?.trim() ?? "");
    const bodyText = await page.$eval("body", (node) => node.innerText);
    evidence.heading = sanitizeText(heading);
    evidence.accountingUnavailableState = bodyText.includes(ACCOUNTING_UNAVAILABLE);
    if (heading !== "Ganancias") {
      throw new Error(`Expected the Ganancias heading; received ${JSON.stringify(heading)}.`);
    }
    if (!evidence.accountingUnavailableState) {
      throw new Error("The stable accounting-unavailable state was not rendered.");
    }

    const cookies = await page.cookies(config.notaryOrigin);
    const authCookies = cookies.filter((cookie) => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name));
    evidence.authCookieCount = authCookies.length;
    evidence.authCookieAttributes = authCookies.map((cookie) => ({
      name: cookie.name.replace(/^sb-([^-]{2})[^-]*/, "sb-$1***"),
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      httpOnly: cookie.httpOnly,
    }));
    if (authCookies.length === 0) {
      throw new AuthenticationEvidenceError(
        "No Supabase authentication cookie was present after authenticated navigation.",
      );
    }

    evidence.status = "PASS";
    evidence.completedAtUtc = new Date().toISOString();
    return evidence;
  } catch (error) {
    evidence.status = error?.acceptanceStatus ?? "FAIL";
    evidence.completedAtUtc = new Date().toISOString();
    evidence.error = sanitizeText(error?.stack ?? error);
    evidence.finalRoute = sanitizeUrl(page.url());
    return evidence;
  } finally {
    await context.close();
  }
}

async function runBrowserChecks(config) {
  const checkedAtUtc = new Date().toISOString();
  const missingCredentials = [];
  if (!config.notaryEmail) missingCredentials.push("H1_NOTARY_EMAIL");
  if (!config.notaryPassword) missingCredentials.push("H1_NOTARY_PASSWORD");
  if (missingCredentials.length > 0) {
    return {
      status: "BLOCKED",
      checkedAtUtc,
      reason: `Required browser credentials are missing: ${missingCredentials.join(", ")}.`,
      contexts: [],
    };
  }

  try {
    await access(config.chromePath, fsConstants.F_OK);
  } catch {
    return {
      status: "BLOCKED",
      checkedAtUtc,
      reason: `Chrome is unavailable at ${config.chromePath}. Set H1_CHROME_PATH.`,
      contexts: [],
    };
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: config.chromePath,
      headless: config.headless,
      args: ["--no-first-run", "--disable-background-networking"],
    });
    const version = await browser.version();
    const contexts = [];
    for (let contextNumber = 1; contextNumber <= 2; contextNumber += 1) {
      contexts.push(await runBrowserContext(browser, config, contextNumber));
    }
    const status = contexts.every((context) => context.status === "PASS")
      ? "PASS"
      : contexts.some((context) => context.status === "FAIL")
        ? "FAIL"
        : "BLOCKED";
    return {
      status,
      checkedAtUtc,
      browser: version,
      headless: config.headless,
      contexts,
    };
  } catch (error) {
    return {
      status: "BLOCKED",
      checkedAtUtc,
      reason: "Chrome/Puppeteer could not launch or complete the clean-context checks.",
      error: sanitizeText(error?.stack ?? error),
      contexts: [],
    };
  } finally {
    await browser?.close();
  }
}

function browserFailure(report) {
  const contexts = report.browser.contexts ?? [];
  const first = contexts[0];
  const second = contexts[1];
  if (report.browser.status === "PASS") return null;
  const blocked = report.browser.status === "BLOCKED";
  return makeFailure({
    id: "H1-BROWSER-GANANCIAS",
    status: report.browser.status,
    severity: blocked ? "Medium" : "High",
    title: blocked
      ? "Authenticated Chrome evidence unavailable"
      : "Authenticated notary earnings route failed",
    reproductionSteps: [
      "Launch the installed Chrome through Puppeteer with a new browser context.",
      `Open ${report.config.notaryOrigin}/auth/login.`,
      "Enter the dedicated QA notary credentials from environment variables and submit.",
      `Navigate directly to ${report.config.notaryOrigin}/ganancias.`,
      "Verify HTTP 200, the Ganancias heading, the accounting-unavailable state, and an auth cookie.",
      "Repeat all steps in a second new browser context.",
    ],
    expectedBehavior:
      "Both clean contexts authenticate on the notary host and render /ganancias with HTTP 200 and the stable accounting-unavailable state.",
    actualBehavior:
      report.browser.reason ??
      `Context 1: ${first?.status ?? "NOT RUN"}; context 2: ${second?.status ?? "NOT RUN"}.`,
    route: first?.finalRoute ?? `${report.config.notaryOrigin}/ganancias`,
    utc: first?.completedAtUtc ?? report.browser.checkedAtUtc,
    deploymentId: report.config.deploymentId,
    error: report.browser.error ?? first?.error ?? second?.error,
    likelyFailingLayer: blocked
      ? "Test credentials or local Chrome/Puppeteer setup"
      : "Notary authentication, hostname routing, server rendering, or commercial-accounting gate",
    secondCleanContext: second
      ? `${second.status}${second.error ? ` — ${second.error}` : ""}`
      : "NOT RUN",
    recommendedNextDiagnostic: blocked
      ? "Provide the missing QA credential environment variables or correct H1_CHROME_PATH, then rerun without changing production data."
      : "Correlate the failing UTC with Vercel function logs and Supabase Auth/API logs; compare the two clean-context network summaries.",
  });
}

function telemetryFailure(report) {
  if (report.telemetry.status === "PASS") return null;
  const hasPayout400 = (report.telemetry.totals?.payout400Count ?? 0) > 0;
  const hasPayoutRequest = (report.telemetry.totals?.payoutRequestCount ?? 0) > 0;
  const unavailable = report.telemetry.status === "BLOCKED" || report.telemetry.status === "PARTIAL";
  return makeFailure({
    id: "H1-SUPABASE-PAYOUT-TELEMETRY",
    status: report.telemetry.status,
    severity: hasPayout400 ? "High" : "Medium",
    title: unavailable
      ? "Required Supabase telemetry evidence unavailable"
      : hasPayout400
        ? "Payout-rate HTTP 400 requests remain in production telemetry"
        : "Disabled payout-rate query still executed",
    reproductionSteps: [
      "Use a Supabase Management API token with analytics_logs_read access.",
      `Query project ${report.config.projectRef} through GET /v1/projects/{ref}/analytics/endpoints/logs.`,
      `Bound the API and SQL query to ${report.config.startUtc}–${report.config.endUtc}.`,
      "Filter the unified logs table to source = edge_logs.",
      `Aggregate total edge rows, requests whose path contains ${PAYOUT_ROUTE}, and matching HTTP 400 responses.`,
    ],
    expectedBehavior:
      "The authenticated query returns retained edge-log coverage, payout_request_count = 0, and payout_400_count = 0.",
    actualBehavior: `${report.telemetry.reason} Counters: ${JSON.stringify(report.telemetry.totals ?? "unavailable")}.`,
    route: PAYOUT_ROUTE,
    utc: `${report.config.startUtc}–${report.config.endUtc}`,
    deploymentId: report.config.deploymentId,
    error: report.telemetry.error ?? report.telemetry.reason,
    likelyFailingLayer: unavailable
      ? "Supabase Management API authentication, analytics authorization, Logs API query, or log retention"
      : hasPayoutRequest
        ? "Server-side notary queue commercial-accounting gate or deployed runtime configuration"
        : "Supabase API/telemetry",
    secondCleanContext:
      "Historical server telemetry is not context-specific; browser context results: " +
      (report.browser.contexts?.map((context) => `#${context.contextNumber} ${context.status}`).join(", ") ||
        "NOT RUN"),
    recommendedNextDiagnostic: unavailable
      ? "Verify the token has analytics_logs_read, confirm project ref and log retention, then rerun the same bounded aggregate without widening beyond 24 hours."
      : "Inspect matching sanitized edge-log event IDs and the deployed COMMERCIAL_ACCOUNTING_ENABLED configuration; do not log request headers or tokens.",
  });
}

function determineOverall(browserStatus, telemetryStatus) {
  if (browserStatus === "FAIL" || telemetryStatus === "FAIL") return "FAIL";
  if (browserStatus === "BLOCKED" || telemetryStatus === "BLOCKED") return "BLOCKED";
  if (browserStatus === "PARTIAL" || telemetryStatus === "PARTIAL") return "PARTIAL";
  return "PASS";
}

function markdownReport(report) {
  const lines = [
    "# H1 Supabase payout telemetry acceptance result",
    "",
    `Overall: **${report.overallStatus}**`,
    "",
    `- Run UTC: ${report.runStartedAtUtc}–${report.runCompletedAtUtc}`,
    `- Historical telemetry window: ${report.config.startUtc}–${report.config.endUtc}`,
    `- Deployment ID: \`${report.config.deploymentId}\``,
    `- Supabase project ref: \`${report.config.projectRef}\``,
    `- Browser evidence: **${report.browser.status}**`,
    `- Authenticated Supabase telemetry: **${report.telemetry.status}**`,
    `- Supabase API authenticated: ${report.telemetry.authenticated === true ? "yes" : "no"}`,
    "",
    "## Telemetry aggregate",
    "",
    `- Total edge-log rows: ${report.telemetry.totals?.totalEdgeRows ?? "unavailable"}`,
    `- \`${PAYOUT_ROUTE}\` requests: ${report.telemetry.totals?.payoutRequestCount ?? "unavailable"}`,
    `- Associated HTTP 400 responses: ${report.telemetry.totals?.payout400Count ?? "unavailable"}`,
    `- First/last retained event: ${report.telemetry.firstEventUtc ?? "unavailable"} / ${report.telemetry.lastEventUtc ?? "unavailable"}`,
    "",
    "## Clean Chrome contexts",
    "",
  ];

  if (report.browser.contexts.length === 0) {
    lines.push(`- ${report.browser.reason ?? "No browser evidence was collected."}`);
  } else {
    for (const context of report.browser.contexts) {
      lines.push(
        `- Context ${context.contextNumber}: **${context.status}**; ${context.finalRoute ?? "no final route"}; HTTP ${context.earningsHttpStatus ?? "unavailable"}; auth cookies ${context.authCookieCount ?? "unavailable"}`,
      );
    }
  }

  lines.push("", "## Failures and blockers", "");
  if (report.failures.length === 0) {
    lines.push("None.");
  } else {
    for (const failure of report.failures) {
      lines.push(
        `### ${failure.id} — ${failure.status}`,
        "",
        `- Severity: ${failure.severity}`,
        `- Title: ${failure.title}`,
        `- Expected: ${failure.expectedBehavior}`,
        `- Actual: ${failure.actualBehavior}`,
        `- Exact route and UTC: \`${failure.exactRouteAndUtc.route}\` at \`${failure.exactRouteAndUtc.utc}\``,
        `- Deployment ID: \`${failure.deploymentId}\``,
        `- Sanitized error or stack: \`${failure.sanitizedErrorOrStack.replace(/`/g, "'")}\``,
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
    "PASS requires two authenticated clean Chrome contexts plus an authenticated Supabase Logs API result with retained edge-log coverage and both payout counters equal to zero. Missing credentials, telemetry authentication, valid query results, or retained coverage cannot produce PASS.",
    "",
  );
  return lines.join("\n");
}

function printHelp() {
  console.log(`Usage: npm run test:h1-telemetry [-- --headed]

Required secret environment variables (never printed or written):
  SUPABASE_ACCESS_TOKEN  Management API token with analytics_logs_read
  H1_NOTARY_EMAIL        Dedicated QA notary email
  H1_NOTARY_PASSWORD     Dedicated QA notary password

Optional:
  SUPABASE_PROJECT_REF   Default: ${DEFAULTS.projectRef}
  H1_DEPLOYMENT_ID       Default: ${DEFAULTS.deploymentId}
  H1_START_UTC           Default: ${DEFAULTS.startUtc}
  H1_END_UTC             Default: ${DEFAULTS.endUtc}
  H1_CHROME_PATH         Default: ${DEFAULTS.chromePath}
  H1_HEADLESS            Default: true; --headed overrides it
  H1_OUTPUT_DIR          Default: artifacts/h1-telemetry
  H1_TIMEOUT_MS          Default: ${DEFAULTS.timeoutMs}

The process exits 0 only for PASS, 1 for a demonstrated FAIL, and 2 for
PARTIAL/BLOCKED evidence. Reports are sanitized and contain no secret values.`);
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
    startUtc: config.startUtc,
    endUtc: config.endUtc,
    deploymentId: config.deploymentId,
    projectRef: config.projectRef,
    notaryOrigin: config.notaryOrigin,
    chromePath: config.chromePath,
    headless: config.headless,
  };

  const browser = await runBrowserChecks(config);
  const telemetry = await queryTelemetry(config);
  const report = {
    schemaVersion: 1,
    runStartedAtUtc,
    runCompletedAtUtc: new Date().toISOString(),
    config: publicConfig,
    browser,
    telemetry,
    overallStatus: determineOverall(browser.status, telemetry.status),
    failures: [],
  };
  report.failures = [browserFailure(report), telemetryFailure(report)].filter(Boolean);

  const runDirectory = path.join(
    config.outputRoot,
    runStartedAtUtc.replace(/[:.]/g, "-"),
  );
  await mkdir(runDirectory, { recursive: true });
  await writeFile(path.join(runDirectory, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(runDirectory, "report.md"), markdownReport(report));

  console.log(`H1 telemetry acceptance: ${report.overallStatus}`);
  console.log(`Browser: ${browser.status}; Supabase telemetry: ${telemetry.status}`);
  console.log(`Sanitized report: ${path.join(runDirectory, "report.md")}`);

  process.exitCode = report.overallStatus === "PASS" ? 0 : report.overallStatus === "FAIL" ? 1 : 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  await main();
}
