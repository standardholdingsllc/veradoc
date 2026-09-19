#!/usr/bin/env node

import { access, mkdir, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";

const DEFAULTS = Object.freeze({
  appOrigin: "https://app.veradoc.pe",
  deploymentId: "dpl_58qbvGJKQeeZrgCNXM54Lqm464dU",
  projectRef: "fyfcslzgahfbyezsnpxl",
  chromePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  timeoutMs: 20_000,
});

function sanitizeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(rawUrl)
      .replace(/([?&][^=\s]+)=([^&\s]+)/g, "$1=[redacted]")
      .replace(/\b(?:code|token|access_token|refresh_token|state)\b/gi, "[redacted]");
  }
}

function sanitizeText(value, maxLength = 2_000) {
  let text = String(value ?? "");
  text = text.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => sanitizeUrl(url));
  text = text
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[jwt-redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email-redacted]")
    .replace(/(password|passwd|access_token|refresh_token|cookie|code|token|state)(\s*[:=]\s*)[^\s,;}]+/gi, "$1$2[redacted]");
  return text.length > maxLength ? `${text.slice(0, maxLength)}…[truncated]` : text;
}

function envPresent(name) {
  return Boolean(process.env[name]?.trim());
}

function makeFailure({
  id,
  status,
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

function readConfig() {
  return {
    appOrigin: new URL(process.env.AUTH_CALLBACK_APP_ORIGIN ?? DEFAULTS.appOrigin).origin,
    deploymentId: process.env.AUTH_CALLBACK_DEPLOYMENT_ID ?? DEFAULTS.deploymentId,
    projectRef: process.env.SUPABASE_PROJECT_REF ?? DEFAULTS.projectRef,
    chromePath: process.env.AUTH_CALLBACK_CHROME_PATH ?? DEFAULTS.chromePath,
    timeoutMs: Number(process.env.AUTH_CALLBACK_TIMEOUT_MS ?? DEFAULTS.timeoutMs),
    outputRoot:
      process.env.AUTH_CALLBACK_OUTPUT_DIR ??
      path.join(process.cwd(), "artifacts", "auth-callback-acceptance"),
    supabaseAccessToken: process.env.SUPABASE_ACCESS_TOKEN,
  };
}

async function fetchRoute(url, options = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
  });
  return {
    status: response.status,
    location: response.headers.get("location")
      ? sanitizeUrl(response.headers.get("location"))
      : null,
    setCookie: Boolean(response.headers.get("set-cookie")),
    deploymentHeaders: {
      server: response.headers.get("server"),
      vercelId: response.headers.get("x-vercel-id"),
      cache: response.headers.get("x-vercel-cache"),
    },
  };
}

async function runRouteBaseline(config, startedAtUtc) {
  const invalidCodeRoute = `${config.appOrigin}/auth/callback?code=[synthetic-invalid]`;
  const invalid = await fetchRoute(
    `${config.appOrigin}/auth/callback?code=synthetic-invalid-callback-code`,
    { timeoutMs: config.timeoutMs },
  );
  const noCode = await fetchRoute(`${config.appOrigin}/auth/callback`, {
    timeoutMs: config.timeoutMs,
  });
  const passed =
    invalid.status === 307 &&
    invalid.location === `${config.appOrigin}/auth/login` &&
    !invalid.setCookie &&
    noCode.status === 307 &&
    noCode.location === `${config.appOrigin}/auth/login` &&
    !noCode.setCookie;

  return {
    id: "C-AUTH-BASELINE-INVALID",
    status: passed ? "PASS" : "FAIL",
    checkedAtUtc: new Date().toISOString(),
    route: invalidCodeRoute,
    invalid,
    noCode,
    expected:
      "An invalid or absent callback credential returns the generic app login failure route without creating a session cookie.",
    actual: `Invalid: HTTP ${invalid.status}, location ${invalid.location ?? "none"}, Set-Cookie ${invalid.setCookie}; no-code: HTTP ${noCode.status}, location ${noCode.location ?? "none"}, Set-Cookie ${noCode.setCookie}.`,
    startedAtUtc,
  };
}

async function runGoogleInitiation(config) {
  const result = {
    id: "C-AUTH-GOOGLE-POSITIVE",
    status: "BLOCKED",
    startedAtUtc: new Date().toISOString(),
    initialRoute: `${config.appOrigin}/auth/login`,
    finalRoute: null,
    providerBoundaryReached: false,
    browser: null,
    error: null,
  };

  try {
    await access(config.chromePath, fsConstants.F_OK);
  } catch {
    result.error = `Chrome is unavailable at ${config.chromePath}.`;
    return result;
  }

  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: true,
    args: ["--no-first-run", "--disable-background-networking"],
  });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(`${config.appOrigin}/auth/login`, {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs,
    });
    result.browser = await browser.version();
    result.loginHttpStatus = response?.status() ?? null;
    await page.waitForSelector('button', { timeout: config.timeoutMs });
    const googleButton = await page.evaluateHandle(() =>
      [...document.querySelectorAll("button")].find((node) =>
        node.textContent?.toLowerCase().includes("google"),
      ),
    );
    if (!googleButton) throw new Error("Google login button was not rendered.");
    await googleButton.asElement().click();
    await page.waitForFunction(
      (appOrigin) => window.location.origin !== appOrigin,
      { timeout: config.timeoutMs },
      config.appOrigin,
    );
    result.finalRoute = sanitizeUrl(page.url());
    result.providerBoundaryReached = new URL(page.url()).hostname.includes("google") ||
      new URL(page.url()).hostname.endsWith("supabase.co");
    result.status = result.providerBoundaryReached ? "PARTIAL" : "FAIL";
    if (!result.providerBoundaryReached) {
      result.error = "Google initiation left the app origin but did not reach a recognized provider boundary.";
    }
  } catch (error) {
    result.error = sanitizeText(error?.stack ?? error);
    result.finalRoute = sanitizeUrl(page.url());
  } finally {
    await context.close();
    await browser.close();
  }
  return result;
}

function telemetrySql(startUtc, endUtc) {
  const start = `parseDateTime64BestEffort('${startUtc}')`;
  const end = `parseDateTime64BestEffort('${endUtc}')`;
  return `select count() as total_edge_rows, countIf(position(log_attributes['request.path'], '/auth/callback') > 0) as callback_count, countIf(position(log_attributes['request.path'], '/auth/callback') > 0 and toInt32OrZero(log_attributes['response.status_code']) >= 400) as callback_error_count, min(timestamp) as first_event_utc, max(timestamp) as last_event_utc from logs where source = 'edge_logs' and timestamp >= ${start} and timestamp <= ${end}`;
}

async function queryTelemetry(config, startUtc, endUtc) {
  const base = {
    status: "BLOCKED",
    checkedAtUtc: new Date().toISOString(),
    authenticated: Boolean(config.supabaseAccessToken),
    startUtc,
    endUtc,
  };
  if (!config.supabaseAccessToken) {
    return { ...base, reason: "SUPABASE_ACCESS_TOKEN is unavailable; callback telemetry cannot be authenticated." };
  }
  const endpoint = new URL(
    `https://api.supabase.com/v1/projects/${config.projectRef}/analytics/endpoints/logs`,
  );
  endpoint.searchParams.set("sql", telemetrySql(startUtc, endUtc));
  endpoint.searchParams.set("iso_timestamp_start", startUtc);
  endpoint.searchParams.set("iso_timestamp_end", endUtc);
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${config.supabaseAccessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const bodyText = await response.text();
    let body;
    try { body = JSON.parse(bodyText); } catch { body = null; }
    if (!response.ok) {
      return { ...base, httpStatus: response.status, reason: `Supabase Logs API returned HTTP ${response.status}.`, error: sanitizeText(body?.message ?? bodyText) };
    }
    const row = body?.result?.[0] ?? body?.[0] ?? body;
    const totals = {
      totalEdgeRows: Number(row?.total_edge_rows ?? 0),
      callbackCount: Number(row?.callback_count ?? 0),
      callbackErrorCount: Number(row?.callback_error_count ?? 0),
    };
    return {
      ...base,
      status: totals.totalEdgeRows > 0 ? "PASS" : "PARTIAL",
      totals,
      firstEventUtc: row?.first_event_utc ?? null,
      lastEventUtc: row?.last_event_utc ?? null,
      reason: totals.totalEdgeRows > 0
        ? "Authenticated edge-log coverage was retained for the run window."
        : "The exact window returned zero edge-log rows; retention coverage is unproven.",
    };
  } catch (error) {
    return { ...base, reason: "Supabase Logs API request did not complete.", error: sanitizeText(error?.stack ?? error) };
  }
}

function buildFailures(report) {
  const failures = [];
  const google = report.google;
  if (google.status !== "PASS") {
    failures.push(makeFailure({
      id: "C-AUTH-01-GOOGLE-POSITIVE",
      status: google.status === "FAIL" ? "FAIL" : "BLOCKED",
      severity: google.status === "FAIL" ? "High" : "Release-evidence blocker",
      title: "Positive Google OAuth callback exchange is not proven",
      reproductionSteps: [
        `Open ${report.config.appOrigin}/auth/login in a new Chrome context.`,
        "Click Continuar con Google.",
        "Authenticate with the disposable Google sandbox identity.",
        "Capture the one-time provider callback in the same context without recording its code or query string.",
        "Verify the callback returns to app.veradoc.pe, establishes only the intended session, and lands on the expected signup/dashboard state.",
        "Repeat in a second clean context and correlate the bounded callback/Auth telemetry window.",
      ],
      expectedBehavior: "The Google sandbox identity completes one OAuth code exchange on app.veradoc.pe, creates the intended host-scoped session, and routes a new realtor to the Google profile-completion flow.",
      actualBehavior: google.error ?? `Only provider initiation was observed; final route was ${google.finalRoute ?? "not reached"}. Disposable Google identity and positive callback evidence were unavailable.`,
      route: google.finalRoute ?? `${report.config.appOrigin}/auth/login`,
      utc: google.startedAtUtc,
      deploymentId: report.config.deploymentId,
      error: google.error,
      likelyFailingLayer: google.error ? "Browser/provider setup or Google OAuth configuration" : "Missing Google sandbox identity and one-time callback capture",
      secondCleanContext: "NOT RUN; duplicating provider initiation without a disposable Google identity would not produce the required exchange evidence.",
      recommendedNextDiagnostic: "Provide a disposable Google sandbox account, confirm the provider callback allowlist, capture the callback only in-memory in a fresh context, and query Auth/edge telemetry for the exact UTC window.",
    }));
  }

  for (const flow of ["magic-link", "password-recovery"]) {
    const mailboxAvailable = flow === "magic-link"
      ? report.prerequisites.magicMailbox
      : report.prerequisites.recoveryMailbox;
    failures.push(makeFailure({
      id: flow === "magic-link" ? "C-AUTH-02-MAGIC-POSITIVE" : "C-AUTH-03-RECOVERY-POSITIVE",
      status: "BLOCKED",
      severity: "Release-evidence blocker",
      title: `${flow} positive callback exchange is untested`,
      reproductionSteps: [
        `Create or select the disposable ${flow} test identity.`,
        "Trigger the supported Supabase email flow without using a production human address.",
        "Retrieve the message through the controlled mailbox/message sink and open the one-time link in a new clean browser context.",
        "Verify the callback lands on app.veradoc.pe, exchanges once, creates the intended session, and does not expose code or credential-bearing query data in evidence.",
        "Replay the link and verify safe rejection, then correlate the exact UTC window with Auth/edge callback telemetry.",
        "Repeat the positive exchange in a second clean context.",
      ],
      expectedBehavior: `The ${flow} message is delivered to the controlled sink and its one-time callback establishes the intended app-host session exactly once, with replay denial and correlated telemetry.`,
      actualBehavior: `No ${flow} mailbox/message retrieval surface was available to this run; positive link retrieval, exchange, replay, and callback telemetry therefore were not observable.${mailboxAvailable ? " A mailbox label was present but retrieval did not complete." : ""}`,
      route: `${report.config.appOrigin}/auth/callback`,
      utc: report.runCompletedAtUtc,
      deploymentId: report.config.deploymentId,
      error: "Required mailbox/message retrieval and disposable identity evidence unavailable.",
      likelyFailingLayer: "QA fixture/message-sink observability boundary, not established product behavior",
      secondCleanContext: "NOT RUN; without a retrievable one-time message, a second browser context cannot execute the positive exchange.",
      recommendedNextDiagnostic: "Provision a disposable identity and controlled mailbox/API retrieval, trigger one message, open the link in two fresh contexts, and correlate Supabase Auth plus edge/provider telemetry without retaining the link or code.",
    }));
  }
  if (report.telemetry.status !== "PASS") {
    failures.push(makeFailure({
      id: "C-AUTH-TELEMETRY",
      status: report.telemetry.status,
      severity: "High",
      title: "Required callback telemetry coverage is unavailable",
      reproductionSteps: [
        "Run the focused callback harness with the read-only Supabase Management API credential.",
        `Query project ${report.config.projectRef} through the Logs API for the exact run window ${report.telemetry.startUtc}–${report.telemetry.endUtc}.`,
        "Aggregate only edge-log coverage and callback request/status counts; do not retrieve raw query strings, cookies, or tokens.",
      ],
      expectedBehavior: "The exact run window has retained, authenticated edge-log coverage sufficient to correlate callback requests and statuses.",
      actualBehavior: report.telemetry.reason,
      route: `${report.config.appOrigin}/auth/callback`,
      utc: `${report.telemetry.startUtc}–${report.telemetry.endUtc}`,
      deploymentId: report.config.deploymentId,
      error: report.telemetry.error ?? report.telemetry.reason,
      likelyFailingLayer: "Supabase Management API authentication, analytics authorization, Logs API query, or retention",
      secondCleanContext: "Telemetry is window-scoped and cannot substitute for a second browser exchange; positive browser contexts were not run.",
      recommendedNextDiagnostic: "Use a read-only token with analytics_logs_read, rerun the same bounded aggregate, and confirm retained rows cover the browser event timestamps.",
    }));
  }
  return failures;
}

function markdown(report) {
  const lines = [
    "# Auth callback acceptance result",
    "",
    `Overall: **${report.overallStatus}**`,
    "",
    `- Run UTC: ${report.runStartedAtUtc}–${report.runCompletedAtUtc}`,
    `- Deployment ID: \`${report.config.deploymentId}\``,
    `- App origin: \`${report.config.appOrigin}\``,
    `- Browser: ${report.google.browser ?? "unavailable"}`,
    `- Google provider initiation: **${report.google.status}**`,
    `- Magic-link positive exchange: **BLOCKED**`,
    `- Password-recovery positive exchange: **BLOCKED**`,
    `- Authenticated edge telemetry: **${report.telemetry.status}**`,
    "",
    "## Sanitized observations",
    "",
    `- Invalid callback baseline: **${report.baseline.status}**; ${report.baseline.actual}`,
    `- Google final route template: \`${report.google.finalRoute ?? "not reached"}\`; provider boundary reached: ${report.google.providerBoundaryReached ? "yes" : "no"}`,
    `- Prerequisites: mailbox=${report.prerequisites.magicMailbox || report.prerequisites.recoveryMailbox ? "label present" : "unavailable"}; Google sandbox identity=${report.prerequisites.googleIdentity ? "label present" : "unavailable"}`,
    `- Telemetry window: ${report.telemetry.startUtc}–${report.telemetry.endUtc}; retained edge rows: ${report.telemetry.totals?.totalEdgeRows ?? "unavailable"}; callback rows: ${report.telemetry.totals?.callbackCount ?? "unavailable"}`,
    "",
    "## Failures and blockers",
    "",
  ];
  for (const failure of report.failures) {
    lines.push(
      `### ${failure.id} — ${failure.status}`,
      "",
      `- Severity: ${failure.severity}`,
      `- Exact reproduction steps: ${failure.reproductionSteps.map((step, index) => `${index + 1}. ${step}`).join(" ")}`,
      `- Expected versus actual behavior: Expected — ${failure.expectedBehavior} Actual — ${failure.actualBehavior}`,
      `- Exact route and UTC: \`${failure.exactRouteAndUtc.route}\` at \`${failure.exactRouteAndUtc.utc}\``,
      `- Deployment ID: \`${failure.deploymentId}\``,
      `- Sanitized error or stack: \`${failure.sanitizedErrorOrStack.replaceAll("`", "'")}\``,
      `- Likely failing layer: ${failure.likelyFailingLayer}`,
      `- Whether it reproduces in a second clean context: ${failure.reproducesInSecondCleanContext}`,
      `- Recommended next diagnostic: ${failure.recommendedNextDiagnostic}`,
      "",
    );
  }
  return lines.join("\n");
}

async function main() {
  const config = readConfig();
  const runStartedAtUtc = new Date().toISOString();
  const baseline = await runRouteBaseline(config, runStartedAtUtc);
  const google = await runGoogleInitiation(config);
  const runCompletedAtUtc = new Date().toISOString();
  const prerequisites = {
    magicMailbox: envPresent("AUTH_CALLBACK_MAGIC_MAILBOX_API_URL") && envPresent("AUTH_CALLBACK_MAGIC_EMAIL"),
    recoveryMailbox: envPresent("AUTH_CALLBACK_RECOVERY_MAILBOX_API_URL") && envPresent("AUTH_CALLBACK_RECOVERY_EMAIL"),
    googleIdentity: envPresent("AUTH_CALLBACK_GOOGLE_EMAIL"),
  };
  const telemetry = await queryTelemetry(config, runStartedAtUtc, runCompletedAtUtc);
  const report = {
    schemaVersion: 1,
    runStartedAtUtc,
    runCompletedAtUtc,
    config: { appOrigin: config.appOrigin, deploymentId: config.deploymentId, projectRef: config.projectRef },
    prerequisites,
    baseline,
    google,
    telemetry,
    overallStatus: "BLOCKED",
    failures: [],
  };
  report.failures = buildFailures(report);
  report.overallStatus = baseline.status === "FAIL" || google.status === "FAIL"
    ? "FAIL"
    : "BLOCKED";
  const runDirectory = path.join(config.outputRoot, runStartedAtUtc.replace(/[:.]/g, "-"));
  await mkdir(runDirectory, { recursive: true });
  await writeFile(path.join(runDirectory, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(runDirectory, "report.md"), markdown(report));
  console.log(`Auth callback acceptance: ${report.overallStatus}`);
  console.log(`Baseline: ${baseline.status}; Google initiation: ${google.status}; telemetry: ${telemetry.status}`);
  console.log(`Sanitized report: ${path.join(runDirectory, "report.md")}`);
  process.exitCode = report.overallStatus === "FAIL" ? 1 : 2;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}

function pathToFileURL(filename) {
  return new URL(`file:///${filename.replaceAll("\\", "/")}`);
}
