#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  decodeSessionCookie,
  parseCredentialTable,
  sanitizeText,
  summarizeCookieAttributes,
} from "./b5-expired-session.mjs";

const CONFIG = Object.freeze({
  appOrigin: "https://app.veradoc.pe",
  deploymentId: process.env.PROVIDER_E2E_DEPLOYMENT_ID
    ?? "dpl_czHsnN2pTCXCtVx8SrMd49cVM759",
  credentialFile: ".env.qa-test-credentials.local.md",
  credentialLabel: "qa-active-realtor",
  chromePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  outputRoot: path.join(process.cwd(), "artifacts", "provider-e2e-production"),
  timeoutMs: 60_000,
});

class BlockedEvidenceError extends Error {
  acceptanceStatus = "BLOCKED";
}

function sanitizeEvidence(value) {
  return sanitizeText(value, 4_000)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[uuid-redacted]")
    .replace(/packets\/[0-9a-f-]{36}/gi, "packets/[packet-id]");
}

function sanitizeRoute(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname
      .replace(/\/paquetes\/[0-9a-f-]{36}(?=\/|$)/gi, "/paquetes/[packet-id]")
      .replace(/\/firma\/[^/]+/gi, "/firma/[token]")}`;
  } catch {
    return sanitizeEvidence(rawUrl);
  }
}

async function loadCredentials() {
  try {
    const markdown = await readFile(path.resolve(CONFIG.credentialFile), "utf8");
    return parseCredentialTable(markdown, CONFIG.credentialLabel);
  } catch (error) {
    throw new BlockedEvidenceError(
      `Credential handoff is unavailable: ${sanitizeEvidence(error?.message ?? error)}`,
    );
  }
}

async function createSyntheticPdf(filePath, marker) {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 36, y: 660, width: 540, height: 90, color: rgb(0.95, 0.9, 0.9) });
  page.drawText("SYNTHETIC TEST - NOT A REAL CONTRACT", {
    x: 55,
    y: 710,
    size: 19,
    font: bold,
    color: rgb(0.65, 0.05, 0.05),
  });
  page.drawText(marker, { x: 55, y: 682, size: 12, font: regular });
  page.drawText("Provider-safe production acceptance fixture. No legal effect.", {
    x: 55,
    y: 640,
    size: 11,
    font: regular,
  });
  page.drawText("Landlord: SYNTHETIC QA LANDLORD", { x: 55, y: 600, size: 11, font: regular });
  page.drawText("Renter: SYNTHETIC QA RENTER", { x: 55, y: 575, size: 11, font: regular });
  page.drawText("Property: SYNTHETIC QA - NOT A REAL PROPERTY", { x: 55, y: 550, size: 11, font: regular });
  await writeFile(filePath, await document.save());
}

function attachEvidence(page, evidence) {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      evidence.console.push({ type: message.type(), text: sanitizeEvidence(message.text()) });
    }
  });
  page.on("pageerror", (error) => {
    evidence.pageErrors.push({
      utc: new Date().toISOString(),
      stage: evidence.stage,
      route: sanitizeRoute(page.url()),
      error: sanitizeEvidence(error?.stack ?? error),
    });
  });
  page.on("requestfailed", (request) => {
    evidence.requestFailures.push({
      method: request.method(),
      route: sanitizeRoute(request.url()),
      error: sanitizeEvidence(request.failure()?.errorText ?? "unknown"),
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
    if (response.status() >= 400) {
      evidence.httpErrors.push({
        method: request.method(),
        route: sanitizeRoute(response.url()),
        status: response.status(),
      });
    }
    if (request.method() === "POST") {
      evidence.postResponses.push({
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

async function login(page, credentials) {
  const response = await page.goto(`${CONFIG.appOrigin}/auth/login`, { waitUntil: "networkidle2" });
  if (!response?.ok()) {
    throw new BlockedEvidenceError(`Login returned HTTP ${response?.status() ?? "unknown"}.`);
  }
  await page.type("#email", credentials.email);
  await page.type("#password", credentials.password);
  await page.click('button[type="submit"]');
  await waitForPath(page, "/agente");

  const cookies = await page.cookies(CONFIG.appOrigin);
  const decoded = decodeSessionCookie(cookies);
  const role = decoded.session.user?.app_metadata?.role ?? decoded.jwt.app_metadata?.role;
  const status = decoded.session.user?.app_metadata?.status ?? decoded.jwt.app_metadata?.status;
  if (role !== "realtor" || status !== "active") {
    throw new BlockedEvidenceError(`Authenticated metadata was ${String(role)}/${String(status)}.`);
  }
  return {
    authCookieCount: decoded.authCookies.length,
    cookieAttributes: summarizeCookieAttributes(cookies),
  };
}

async function clickButton(page, label) {
  const clicked = await page.$$eval("button", (buttons, expected) => {
    const button = buttons.find((candidate) => candidate.textContent?.trim().includes(expected));
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`Enabled button ${JSON.stringify(label)} was not found.`);
}

async function fillLabeled(page, labelText, value, occurrence = 0) {
  const selector = await page.evaluate((expected, index) => {
    const labels = [...document.querySelectorAll("label")].filter((label) => {
      const caption = label.querySelector("span")?.textContent?.trim();
      return caption === expected;
    });
    const target = labels[index]?.querySelector("input, textarea, select");
    if (!target) return null;
    const marker = `qa-field-${expected}-${index}`.replace(/[^a-z0-9-]/gi, "-");
    target.setAttribute("data-qa-e2e", marker);
    return `[data-qa-e2e="${marker}"]`;
  }, labelText, occurrence);
  if (!selector) throw new Error(`Field ${JSON.stringify(labelText)} occurrence ${occurrence} was not found.`);
  const inputType = await page.$eval(selector, (element) => element.getAttribute("type"));
  if (inputType === "date") {
    await page.$eval(selector, (element, nextValue) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, nextValue);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    return;
  }
  await page.focus(selector);
  await page.$eval(selector, (element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.value = "";
  });
  await page.type(selector, value);
}

async function waitForStep(page, step) {
  await page.waitForFunction(
    (expected) => document.body.innerText.includes(`Paso ${expected} de 6`),
    { timeout: CONFIG.timeoutMs },
    step,
  );
}

function baseEvidence(contextNumber, marker) {
  return {
    contextNumber,
    marker,
    startedAtUtc: new Date().toISOString(),
    finishedAtUtc: null,
    deploymentId: CONFIG.deploymentId,
    route: `${CONFIG.appOrigin}/agente/nuevo-paquete`,
    status: "FAIL",
    stage: "initializing",
    authentication: null,
    observedError: null,
    expectedProviderCalls: 0,
    console: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    postResponses: [],
    documentResponses: [],
  };
}

async function runContext(browser, credentials, runId, contextNumber) {
  const marker = `VD-QA-PROD-${runId}-C${contextNumber}`;
  const evidence = baseEvidence(contextNumber, marker);
  const pdfPath = path.join(CONFIG.outputRoot, `${marker}.pdf`);
  const screenshotPath = path.join(CONFIG.outputRoot, `${marker}.png`);
  await createSyntheticPdf(pdfPath, marker);

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeoutMs);
  page.setDefaultNavigationTimeout(CONFIG.timeoutMs);
  await page.setViewport({ width: 1440, height: 1000 });
  attachEvidence(page, evidence);

  try {
    evidence.stage = "login";
    evidence.authentication = await login(page, credentials);

    evidence.stage = "upload";
    const response = await page.goto(`${CONFIG.appOrigin}/agente/nuevo-paquete`, { waitUntil: "networkidle2" });
    if (!response?.ok()) throw new Error(`Wizard returned HTTP ${response?.status() ?? "unknown"}.`);
    const input = await page.$('input[type="file"]');
    if (!input) throw new Error("PDF upload input was not found.");
    await input.uploadFile(pdfPath);
    await page.waitForFunction((name) => {
      const body = document.body.innerText;
      return (body.includes(name) && body.includes("Cargado")) || Boolean(document.querySelector('[data-sonner-toast]'));
    }, { timeout: CONFIG.timeoutMs }, `${marker}.pdf`);
    const uploadToast = await page.$eval('[data-sonner-toast]', (node) => node.textContent?.trim() ?? "").catch(() => null);
    if (uploadToast) throw new Error(`Upload did not complete: ${sanitizeEvidence(uploadToast)}`);
    await clickButton(page, "Siguiente");
    await waitForStep(page, 2);

    evidence.stage = "contract-data";
    await fillLabeled(page, "Dirección del inmueble", `SYNTHETIC QA - NOT A REAL PROPERTY - ${marker}`);
    await fillLabeled(page, "Unidad/Departamento", `QA-${contextNumber}`);
    await fillLabeled(page, "Renta mensual", "1000");
    await fillLabeled(page, "Depósito", "1000");
    await fillLabeled(page, "Fecha de inicio", "2026-10-01");
    await fillLabeled(page, "Fecha de vencimiento", "2027-09-30");
    await fillLabeled(page, "Notas", "SYNTHETIC TEST ONLY - NO LEGAL EFFECT");
    await clickButton(page, "Siguiente");
    await waitForStep(page, 3);

    evidence.stage = "signers";
    await fillLabeled(page, "Nombre completo", "SYNTHETIC QA LANDLORD", 0);
    await fillLabeled(page, "Correo electrónico", "delivered@resend.dev", 0);
    await fillLabeled(page, "WhatsApp", "+51000000001", 0);
    await fillLabeled(page, "DNI", "00000001", 0);
    await fillLabeled(page, "Nombre completo", "SYNTHETIC QA RENTER", 1);
    await fillLabeled(page, "Correo electrónico", "bounced@resend.dev", 1);
    await fillLabeled(page, "WhatsApp", "+51000000002", 1);
    await fillLabeled(page, "DNI", "00000002", 1);
    await clickButton(page, "Siguiente");
    await waitForStep(page, 4);
    await clickButton(page, "Siguiente");
    await waitForStep(page, 5);

    evidence.stage = "payment-preparation";
    await fillLabeled(page, "DNI (8 dígitos)", "00000000");
    await fillLabeled(page, "Nombre completo del comprador", "SYNTHETIC QA BUYER");
    const checkbox = await page.$('input[type="checkbox"]');
    if (!checkbox) throw new Error("Billing confirmation checkbox was not found.");
    await checkbox.click();

    const paymentCallUrls = [];
    const inspectRequest = (request) => {
      const url = request.url();
      if (/mercadopago|api\.mercadopago/i.test(url)) paymentCallUrls.push(sanitizeRoute(url));
    };
    page.on("request", inspectRequest);
    const clickedAtUtc = new Date().toISOString();
    await clickButton(page, "Pagar y crear paquete");
    await page.waitForFunction(
      () => document.body.innerText.includes("claim_commercial_payment_attempt"),
      { timeout: CONFIG.timeoutMs },
    );
    const toastText = await page.$eval(
      '[data-sonner-toast]',
      (node) => node.textContent?.trim() ?? "",
    );
    page.off("request", inspectRequest);
    evidence.paymentClickedAtUtc = clickedAtUtc;
    evidence.observedError = sanitizeEvidence(toastText);
    evidence.externalPaymentRequests = paymentCallUrls;
    evidence.packetCreatedBeforeFailure = true;
    evidence.providerNotReached = paymentCallUrls.length === 0;
    evidence.finalRoute = sanitizeRoute(page.url());
    evidence.status =
      evidence.observedError.includes("claim_commercial_payment_attempt") && evidence.providerNotReached
        ? "EXPECTED_FAILURE_REPRODUCED"
        : "FAIL";
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (error) {
    evidence.status = error?.acceptanceStatus ?? "FAIL";
    evidence.failureStage = evidence.stage;
    evidence.harnessError = sanitizeEvidence(error?.stack ?? error);
    evidence.finalRoute = sanitizeRoute(page.url());
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  } finally {
    evidence.finishedAtUtc = new Date().toISOString();
    evidence.stage = "finished";
    await context.close();
    await rm(pdfPath, { force: true });
  }
  return evidence;
}

async function main() {
  await mkdir(CONFIG.outputRoot, { recursive: true });
  const startedAtUtc = new Date().toISOString();
  const runId = startedAtUtc.replace(/[-:.TZ]/g, "").slice(0, 14);
  const credentials = await loadCredentials();
  let browser;
  const result = {
    startedAtUtc,
    finishedAtUtc: null,
    deploymentId: CONFIG.deploymentId,
    chromeVersion: null,
    acceptanceStatus: "FAIL",
    contexts: [],
  };
  try {
    browser = await puppeteer.launch({
      executablePath: CONFIG.chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    result.chromeVersion = await browser.version();
    for (let contextNumber = 1; contextNumber <= 2; contextNumber += 1) {
      result.contexts.push(await runContext(browser, credentials, runId, contextNumber));
    }
    result.acceptanceStatus = result.contexts.every(
      (context) => context.status === "EXPECTED_FAILURE_REPRODUCED",
    ) ? "FAIL_CONFIRMED" : "PARTIAL";
  } finally {
    result.finishedAtUtc = new Date().toISOString();
    if (browser) await browser.close();
    const outputPath = path.join(CONFIG.outputRoot, `evidence-${startedAtUtc.replace(/[:.]/g, "-")}.json`);
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ ...result, evidencePath: outputPath }, null, 2)}\n`);
  }
  if (result.acceptanceStatus !== "FAIL_CONFIRMED") process.exitCode = 1;
}

await main();
