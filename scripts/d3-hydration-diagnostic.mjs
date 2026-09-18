#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";
import { parseCredentialTable, sanitizeText } from "./b5-expired-session.mjs";

const config = {
  origin: process.env.D3_NOTARY_ORIGIN ?? "https://notario.veradoc.pe",
  packetCode: "QA-D3-20260917-01",
  credentialFile: process.env.D3_CREDENTIAL_FILE ?? ".env.qa-test-credentials.local.md",
  chromePath: process.env.D3_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  timeoutMs: 45_000,
  outputRoot: path.join(process.cwd(), "artifacts", "d3-hydration-diagnostic"),
};

function sanitizeRoute(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname.replace(/\/paquetes\/[0-9a-f-]{36}/gi, "/paquetes/[packet-id]")}`;
  } catch {
    return "[invalid-route]";
  }
}

function extractLabelValue(bodyText, label) {
  const lines = String(bodyText).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const index = lines.indexOf(label);
  return index >= 0 ? lines[index + 1] ?? null : null;
}

function extractDateFields(bodyText) {
  return {
    leaseStart: extractLabelValue(bodyText, "Fecha inicio"),
    leaseEnd: extractLabelValue(bodyText, "Fecha fin"),
    submittedAt: extractLabelValue(bodyText, "Enviado al notario"),
  };
}

async function credentials() {
  const markdown = await readFile(path.resolve(config.credentialFile), "utf8");
  return parseCredentialTable(markdown, "qa-active-notary");
}

async function waitForPath(page, pathname) {
  await page.waitForFunction(
    (expected) => location.pathname === expected,
    { timeout: config.timeoutMs },
    pathname,
  );
  await page.waitForNetworkIdle({ idleTime: 500, timeout: config.timeoutMs });
}

async function authenticateAndDiscover(browser, credential) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeoutMs);
  page.setDefaultNavigationTimeout(config.timeoutMs);
  await page.goto(`${config.origin}/auth/login`, { waitUntil: "networkidle2" });
  await page.type("#email", credential.email);
  await page.type("#password", credential.password);
  await page.click('button[type="submit"]');
  await waitForPath(page, "/");
  const detailPath = await page.$$eval(
    "a",
    (links, packetCode) => links.find(
      (link) => link.textContent?.trim() === packetCode,
    )?.getAttribute("href") ?? null,
    config.packetCode,
  );
  if (!detailPath || !/^\/paquetes\/[0-9a-f-]{36}$/i.test(detailPath)) {
    throw new Error("Could not discover the synthetic packet detail link.");
  }
  const cookies = await page.cookies(config.origin);
  await context.close();
  return { detailPath, cookies };
}

async function serverOnlySnapshot(browser, detailPath, cookies) {
  const context = await browser.createBrowserContext();
  await context.setCookie(...cookies);
  const page = await context.newPage();
  await page.setJavaScriptEnabled(false);
  const response = await page.goto(`${config.origin}${detailPath}`, { waitUntil: "domcontentloaded" });
  const body = await page.$eval("body", (node) => node.innerText);
  const result = {
    httpStatus: response?.status() ?? null,
    route: sanitizeRoute(page.url()),
    fields: extractDateFields(body),
    packetRendered: body.includes(config.packetCode),
  };
  await context.close();
  return result;
}

async function hydratedSnapshot(browser, detailPath, cookies, timezoneId) {
  const context = await browser.createBrowserContext();
  await context.setCookie(...cookies);
  const page = await context.newPage();
  if (timezoneId) await page.emulateTimezone(timezoneId);
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push(sanitizeText(error?.message ?? error));
  });
  const response = await page.goto(`${config.origin}${detailPath}`, { waitUntil: "networkidle2" });
  const body = await page.$eval("body", (node) => node.innerText);
  const browserTimeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const result = {
    timezone: browserTimeZone,
    requestedTimezone: timezoneId ?? "host-default",
    httpStatus: response?.status() ?? null,
    route: sanitizeRoute(page.url()),
    fields: extractDateFields(body),
    packetRendered: body.includes(config.packetCode),
    hydrationErrors: errors.filter((error) => error.includes("React error #418")),
    allPageErrors: errors,
  };
  await context.close();
  return result;
}

async function main() {
  const startedAtUtc = new Date().toISOString();
  let browser;
  const report = { startedAtUtc, origin: config.origin, packetCode: config.packetCode };
  try {
    const credential = await credentials();
    browser = await puppeteer.launch({
      executablePath: config.chromePath,
      headless: true,
      args: ["--no-first-run", "--disable-background-networking"],
    });
    report.browser = await browser.version();
    const session = await authenticateAndDiscover(browser, credential);
    report.route = `${config.origin}/paquetes/[packet-id]`;
    report.serverOnly = await serverOnlySnapshot(browser, session.detailPath, session.cookies);
    report.hostTimezone = await hydratedSnapshot(browser, session.detailPath, session.cookies, null);
    report.utcTimezone = await hydratedSnapshot(browser, session.detailPath, session.cookies, "UTC");
    report.comparison = {
      serverEqualsHost: JSON.stringify(report.serverOnly.fields) === JSON.stringify(report.hostTimezone.fields),
      serverEqualsUtc: JSON.stringify(report.serverOnly.fields) === JSON.stringify(report.utcTimezone.fields),
      hostHydrationErrorCount: report.hostTimezone.hydrationErrors.length,
      utcHydrationErrorCount: report.utcTimezone.hydrationErrors.length,
    };
    report.status = "COMPLETE";
  } catch (error) {
    report.status = "BLOCKED";
    report.error = sanitizeText(error?.stack ?? error);
  } finally {
    await browser?.close();
    report.completedAtUtc = new Date().toISOString();
    await mkdir(config.outputRoot, { recursive: true });
    const outputPath = path.join(
      config.outputRoot,
      `evidence-${startedAtUtc.replace(/[:.]/g, "-")}.json`,
    );
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...report, artifact: path.relative(process.cwd(), outputPath) }, null, 2));
  }
  process.exitCode = report.status === "COMPLETE" ? 0 : 1;
}

await main();
