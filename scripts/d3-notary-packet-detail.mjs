#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";
import {
  decodeSessionCookie,
  parseCredentialTable,
  sanitizeText,
  summarizeCookieAttributes,
} from "./b5-expired-session.mjs";

const CONFIG = Object.freeze({
  notaryOrigin: "https://notario.veradoc.pe",
  appOrigin: "https://app.veradoc.pe",
  deploymentId: "dpl_8M8f8wa9hgcYfQsBf4hi77UqCD51",
  packetCode: "QA-D3-20260917-01",
  packetAddress: "SYNTHETIC QA - NOT A REAL PROPERTY - D3 NAV 20260917",
  credentialFile: ".env.qa-test-credentials.local.md",
  chromePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  outputRoot: path.join(process.cwd(), "artifacts", "d3-notary-packet-detail"),
  timeoutMs: 45_000,
});

class BlockedEvidenceError extends Error {
  acceptanceStatus = "BLOCKED";
}

function sanitizeRoute(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.replace(
      /\/paquetes\/[0-9a-f-]{36}(?=\/|$)/gi,
      "/paquetes/[packet-id]",
    );
    return `${url.origin}${pathname}`;
  } catch {
    return sanitizeText(rawUrl).replace(
      /\/paquetes\/[0-9a-f-]{36}(?=\/|\s|$)/gi,
      "/paquetes/[packet-id]",
    );
  }
}

async function loadCredentials(label) {
  let markdown;
  try {
    markdown = await readFile(path.resolve(CONFIG.credentialFile), "utf8");
  } catch {
    throw new BlockedEvidenceError(
      `Ignored credential handoff ${CONFIG.credentialFile} is unavailable.`,
    );
  }
  return parseCredentialTable(markdown, label);
}

function attachEvidence(page, evidence) {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      evidence.console.push({
        type: message.type(),
        text: sanitizeText(message.text()),
      });
    }
  });
  page.on("pageerror", (error) => {
    evidence.pageErrors.push({
      utc: new Date().toISOString(),
      stage: evidence.stage ?? "unknown",
      route: sanitizeRoute(page.url()),
      error: sanitizeText(error?.stack ?? error),
    });
  });
  page.on("requestfailed", (request) => {
    evidence.requestFailures.push({
      method: request.method(),
      route: sanitizeRoute(request.url()),
      error: sanitizeText(request.failure()?.errorText ?? "unknown"),
    });
  });
  page.on("response", (response) => {
    const request = response.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      evidence.documentResponses.push({
        method: request.method(),
        route: sanitizeRoute(response.url()),
        status: response.status(),
      });
    }
    if (response.status() >= 500) {
      evidence.http5xx.push({
        method: request.method(),
        route: sanitizeRoute(response.url()),
        status: response.status(),
      });
    }
  });
}

async function waitForPath(page, pathname) {
  await page.waitForFunction(
    (expected) => window.location.pathname === expected,
    { timeout: CONFIG.timeoutMs },
    pathname,
  );
  await page.waitForNetworkIdle({ idleTime: 500, timeout: CONFIG.timeoutMs });
}

async function waitForUrl(page, predicate, description) {
  const deadline = Date.now() + CONFIG.timeoutMs;
  while (Date.now() < deadline) {
    const current = page.url();
    try {
      if (predicate(new URL(current))) return;
    } catch {
      // The page may briefly expose an incomplete URL during navigation.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${description}; final route ${sanitizeRoute(page.url())}.`);
}

async function login(page, credentials, expectedRole, expectedOrigin, expectedPath) {
  const response = await page.goto(`${expectedOrigin}/auth/login`, {
    waitUntil: "networkidle2",
  });
  if (!response?.ok()) {
    throw new BlockedEvidenceError(
      `Login document returned HTTP ${response?.status() ?? "unknown"}.`,
    );
  }
  await page.type("#email", credentials.email);
  await page.type("#password", credentials.password);
  await page.click('button[type="submit"]');
  await waitForPath(page, expectedPath);
  if (new URL(page.url()).origin !== expectedOrigin) {
    throw new BlockedEvidenceError(
      `Authentication left the expected origin: ${sanitizeRoute(page.url())}.`,
    );
  }

  const cookies = await page.cookies(expectedOrigin);
  const decoded = decodeSessionCookie(cookies);
  const role = decoded.session.user?.app_metadata?.role ?? decoded.jwt.app_metadata?.role;
  const status = decoded.session.user?.app_metadata?.status ?? decoded.jwt.app_metadata?.status;
  if (role !== expectedRole || status !== "active") {
    throw new BlockedEvidenceError(
      `Authenticated metadata was ${String(role)}/${String(status)}, not ${expectedRole}/active.`,
    );
  }
  return {
    authCookieCount: decoded.authCookies.length,
    cookieAttributes: summarizeCookieAttributes(cookies),
  };
}

function pageText(page) {
  return page.$eval("body", (node) => node.innerText);
}

function heading(page) {
  return page.$eval("h1", (node) => node.textContent?.trim() ?? "").catch(() => "");
}

function commonEvidence(contextNumber) {
  return {
    contextNumber,
    startedAtUtc: new Date().toISOString(),
    viewport: "1280x720",
    status: "FAIL",
    console: [],
    pageErrors: [],
    requestFailures: [],
    http5xx: [],
    documentResponses: [],
  };
}

async function runNotaryContext(browser, credentials, contextNumber) {
  const evidence = commonEvidence(contextNumber);
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeoutMs);
  page.setDefaultNavigationTimeout(CONFIG.timeoutMs);
  await page.setViewport({ width: 1280, height: 720 });
  attachEvidence(page, evidence);

  let detailPath = null;
  try {
    evidence.stage = "login";
    const auth = await login(page, credentials, "notary", CONFIG.notaryOrigin, "/");
    evidence.stage = "dashboard";
    evidence.authentication = auth;
    evidence.dashboardHeading = sanitizeText(await heading(page));
    evidence.dashboardRoute = sanitizeRoute(page.url());
    if (evidence.dashboardHeading !== "Panel del notario") {
      throw new Error(`Expected the notary dashboard heading; received ${JSON.stringify(evidence.dashboardHeading)}.`);
    }

    detailPath = await page.$$eval(
      "a",
      (links, packetCode) => links.find(
        (link) => link.textContent?.trim() === packetCode,
      )?.getAttribute("href") ?? null,
      CONFIG.packetCode,
    );
    if (!detailPath || !/^\/paquetes\/[0-9a-f-]{36}$/i.test(detailPath)) {
      throw new Error("The fixture queue link did not expose a valid packet-detail path.");
    }
    const selector = `a[href="${detailPath}"]`;
    await page.waitForSelector(selector);
    evidence.dashboardLinkVisible = true;
    evidence.stage = "detail-client-navigation";
    await page.click(selector);
    await waitForPath(page, detailPath);

    const detailBody = await pageText(page);
    evidence.detailRoute = sanitizeRoute(page.url());
    evidence.detailRendered =
      detailBody.includes(CONFIG.packetCode) &&
      detailBody.includes(CONFIG.packetAddress) &&
      detailBody.includes("Resumen del paquete") &&
      detailBody.includes("Sin firmantes registrados.");
    if (!evidence.detailRendered) {
      throw new Error("Packet detail did not render all expected synthetic fixture markers.");
    }

    evidence.stage = "detail-refresh";
    const refreshResponse = await page.reload({ waitUntil: "networkidle2" });
    const refreshBody = await pageText(page);
    evidence.refresh = {
      status: refreshResponse?.status() ?? null,
      route: sanitizeRoute(page.url()),
      rendered: refreshBody.includes(CONFIG.packetCode) && refreshBody.includes(CONFIG.packetAddress),
    };
    if (evidence.refresh.status !== 200 || !evidence.refresh.rendered) {
      throw new Error(`Direct refresh failed: ${JSON.stringify(evidence.refresh)}.`);
    }

    evidence.stage = "history-back";
    await page.goBack({ waitUntil: "networkidle2" });
    await waitForPath(page, "/");
    evidence.historyBack = {
      route: sanitizeRoute(page.url()),
      heading: sanitizeText(await heading(page)),
      fixtureLinkVisible: Boolean(await page.$(selector)),
    };
    if (evidence.historyBack.heading !== "Panel del notario" || !evidence.historyBack.fixtureLinkVisible) {
      throw new Error(`History back did not restore the notary queue: ${JSON.stringify(evidence.historyBack)}.`);
    }

    evidence.stage = "history-forward";
    await page.goForward({ waitUntil: "networkidle2" });
    await waitForPath(page, detailPath);
    const forwardBody = await pageText(page);
    evidence.historyForward = {
      route: sanitizeRoute(page.url()),
      rendered: forwardBody.includes(CONFIG.packetCode) && forwardBody.includes(CONFIG.packetAddress),
    };
    if (!evidence.historyForward.rendered) {
      throw new Error(`History forward did not restore packet detail: ${JSON.stringify(evidence.historyForward)}.`);
    }

    const materialFailures = evidence.requestFailures.filter(
      (failure) => failure.error !== "net::ERR_ABORTED",
    );
    evidence.materialRequestFailureCount = materialFailures.length;
    evidence.cleanPublicPaths = [
      evidence.dashboardRoute,
      evidence.detailRoute,
      evidence.refresh.route,
      evidence.historyBack.route,
      evidence.historyForward.route,
    ].every((route) => !new URL(route).pathname.startsWith("/notario"));

    if (
      evidence.pageErrors.length ||
      evidence.http5xx.length ||
      materialFailures.length ||
      !evidence.cleanPublicPaths
    ) {
      throw new Error("Material browser errors or internal notary-prefix leakage were observed.");
    }
    evidence.status = "PASS";
  } catch (error) {
    evidence.status = error?.acceptanceStatus ?? "FAIL";
    evidence.error = sanitizeText(error?.stack ?? error);
    evidence.finalRoute = sanitizeRoute(page.url());
  } finally {
    evidence.completedAtUtc = new Date().toISOString();
    await context.close();
  }
  return { evidence, detailPath };
}

async function runWrongRoleContext(browser, credentials, detailPath) {
  const evidence = commonEvidence("wrong-role-realtor");
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeoutMs);
  page.setDefaultNavigationTimeout(CONFIG.timeoutMs);
  await page.setViewport({ width: 1280, height: 720 });
  attachEvidence(page, evidence);

  try {
    evidence.stage = "wrong-role-login";
    const response = await page.goto(`${CONFIG.notaryOrigin}/auth/login`, { waitUntil: "networkidle2" });
    if (!response?.ok()) throw new Error(`Wrong-role login document returned HTTP ${response?.status() ?? "unknown"}.`);
    await page.type("#email", credentials.email);
    await page.type("#password", credentials.password);
    await page.click('button[type="submit"]');
    await waitForUrl(
      page,
      (url) => url.origin === CONFIG.appOrigin,
      "the canonical application-origin wrong-role denial",
    );
    await page.waitForNetworkIdle({ idleTime: 500, timeout: CONFIG.timeoutMs }).catch(() => {});
    const loginDeniedUrl = new URL(page.url());
    evidence.loginDenial = {
      route: `${loginDeniedUrl.origin}${loginDeniedUrl.pathname}`,
      wrongSurfaceError: loginDeniedUrl.searchParams.get("error") === "wrong-surface",
      packetDataVisible: (await pageText(page)).includes(CONFIG.packetCode),
    };

    evidence.stage = "wrong-role-direct-detail";
    const directResponse = await page.goto(
      `${CONFIG.notaryOrigin}${detailPath}`,
      { waitUntil: "networkidle2" },
    );
    const directUrl = new URL(page.url());
    const directBody = await pageText(page);
    evidence.directDenial = {
      initialStatus: directResponse?.status() ?? null,
      route: sanitizeRoute(page.url()),
      loginRendered: directUrl.origin === CONFIG.notaryOrigin && directUrl.pathname === "/auth/login",
      packetDataVisible: directBody.includes(CONFIG.packetCode) || directBody.includes(CONFIG.packetAddress),
    };

    const cdp = await page.createCDPSession();
    const applicableCookies = await cdp.send("Network.getCookies", {
      urls: [`${CONFIG.notaryOrigin}${detailPath}`],
    });
    evidence.notaryAuthCookieCount = applicableCookies.cookies.filter((cookie) =>
      /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name),
    ).length;

    const materialFailures = evidence.requestFailures.filter(
      (failure) => failure.error !== "net::ERR_ABORTED",
    );
    evidence.materialRequestFailureCount = materialFailures.length;
    if (
      !evidence.loginDenial.wrongSurfaceError ||
      evidence.loginDenial.packetDataVisible ||
      !evidence.directDenial.loginRendered ||
      evidence.directDenial.packetDataVisible ||
      evidence.notaryAuthCookieCount !== 0 ||
      evidence.pageErrors.length ||
      evidence.http5xx.length ||
      materialFailures.length
    ) {
      throw new Error("Wrong-role denial evidence did not satisfy all expected checks.");
    }
    evidence.status = "PASS";
  } catch (error) {
    evidence.status = error?.acceptanceStatus ?? "FAIL";
    evidence.error = sanitizeText(error?.stack ?? error);
    evidence.finalRoute = sanitizeRoute(page.url());
  } finally {
    evidence.completedAtUtc = new Date().toISOString();
    await context.close();
  }
  return evidence;
}

function failureRecord(result) {
  return {
    severity: result.status === "BLOCKED" ? "Release evidence blocker" : "High",
    exactReproductionSteps: result.contextNumber === "wrong-role-realtor"
      ? [
          "Open a clean Chrome context at notario.veradoc.pe/auth/login.",
          "Submit the dedicated active realtor fixture credentials.",
          "Navigate directly to notario.veradoc.pe/paquetes/[packet-id].",
        ]
      : [
          "Open a clean Chrome context and authenticate qa-active-notary on notario.veradoc.pe.",
          "Click QA-D3-20260917-01 in the notary queue.",
          "Reload, then use browser Back and Forward.",
        ],
    expectedVersusActual: `Expected every scoped check to pass; actual status ${result.status}: ${result.error ?? "required evidence unavailable"}.`,
    exactRouteAndUtc: `${result.finalRoute ?? result.detailRoute ?? "route unavailable"}; ${result.startedAtUtc}–${result.completedAtUtc}`,
    deploymentId: CONFIG.deploymentId,
    sanitizedErrorOrStack: result.error ?? "No stack was available.",
    likelyFailingLayer: result.status === "BLOCKED" ? "QA authentication/test environment" : "Notary routing, authorization, or packet detail rendering",
    secondCleanContext: "See contexts array; no PASS is inferred when a required context is unavailable.",
    recommendedNextDiagnostic: "Inspect the matching sanitized browser document responses and exact-window server/database telemetry before changing application code.",
  };
}

async function main() {
  const report = {
    testId: "D-NOTARY-PACKET-DETAIL-01",
    deploymentId: CONFIG.deploymentId,
    browser: null,
    startedAtUtc: new Date().toISOString(),
    fixture: {
      packetCode: CONFIG.packetCode,
      packetRoute: `${CONFIG.notaryOrigin}/paquetes/[packet-id]`,
      providerActionsInvoked: false,
    },
    contexts: [],
    status: "BLOCKED",
  };
  let browser;
  try {
    const [notaryCredentials, realtorCredentials] = await Promise.all([
      loadCredentials("qa-active-notary"),
      loadCredentials("qa-active-realtor"),
    ]);
    if (notaryCredentials.role !== "notary" || notaryCredentials.status !== "active") {
      throw new BlockedEvidenceError("qa-active-notary credential metadata is not notary/active.");
    }
    if (realtorCredentials.role !== "realtor" || realtorCredentials.status !== "active") {
      throw new BlockedEvidenceError("qa-active-realtor credential metadata is not realtor/active.");
    }

    browser = await puppeteer.launch({
      executablePath: CONFIG.chromePath,
      headless: true,
      args: ["--no-first-run", "--disable-background-networking"],
    });
    report.browser = await browser.version();
    const firstNotary = await runNotaryContext(browser, notaryCredentials, 1);
    const secondNotary = await runNotaryContext(browser, notaryCredentials, 2);
    report.contexts.push(firstNotary.evidence, secondNotary.evidence);
    if (!firstNotary.detailPath || firstNotary.detailPath !== secondNotary.detailPath) {
      throw new BlockedEvidenceError(
        "The two notary contexts did not resolve the same sanitized fixture link.",
      );
    }
    report.contexts.push(
      await runWrongRoleContext(browser, realtorCredentials, firstNotary.detailPath),
    );
    report.status = report.contexts.every((context) => context.status === "PASS")
      ? "PASS"
      : report.contexts.some((context) => context.status === "FAIL")
        ? "FAIL"
        : "BLOCKED";
  } catch (error) {
    report.error = sanitizeText(error?.stack ?? error);
    report.status = error?.acceptanceStatus ?? "FAIL";
  } finally {
    await browser?.close();
    report.completedAtUtc = new Date().toISOString();
    report.failures = report.contexts
      .filter((context) => context.status !== "PASS")
      .map(failureRecord);
    if (report.error) {
      report.failures.push(failureRecord({
        status: report.status,
        error: report.error,
        startedAtUtc: report.startedAtUtc,
        completedAtUtc: report.completedAtUtc,
      }));
    }
    await mkdir(CONFIG.outputRoot, { recursive: true });
    const filename = `evidence-${report.startedAtUtc.replace(/[:.]/g, "-")}.json`;
    const outputPath = path.join(CONFIG.outputRoot, filename);
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      status: report.status,
      startedAtUtc: report.startedAtUtc,
      completedAtUtc: report.completedAtUtc,
      deploymentId: report.deploymentId,
      browser: report.browser,
      contextStatuses: report.contexts.map((context) => ({
        context: context.contextNumber,
        status: context.status,
        finalRoute: context.historyForward?.route ?? context.directDenial?.route ?? context.finalRoute,
        authCookieCount: context.authentication?.authCookieCount ?? context.notaryAuthCookieCount,
        consoleCount: context.console.length,
        pageErrorCount: context.pageErrors.length,
        http5xxCount: context.http5xx.length,
        materialRequestFailureCount: context.materialRequestFailureCount,
      })),
      artifact: path.relative(process.cwd(), outputPath),
      failures: report.failures,
    }, null, 2));
  }
  process.exitCode = report.status === "PASS" ? 0 : 1;
}

await main();
