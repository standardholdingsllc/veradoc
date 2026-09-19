#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import puppeteer from "puppeteer-core";
import { sanitizeText } from "./b5-expired-session.mjs";

const execFile = promisify(execFileCallback);
const CONFIG = Object.freeze({
  appOrigin: "https://app.veradoc.pe",
  apexOrigin: "https://veradoc.pe",
  demoOrigin: "https://demo.veradoc.pe",
  deploymentId: process.env.PROVIDER_E2E_DEPLOYMENT_ID
    ?? "dpl_czHsnN2pTCXCtVx8SrMd49cVM759",
  chromePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  outputRoot: path.join(process.cwd(), "artifacts", "provider-signing-token-production"),
  timeoutMs: 45_000,
});

function sanitize(value) {
  return sanitizeText(value, 4_000)
    .replace(/\/firma\/[^/?\s]+/gi, "/firma/[token]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[sha256-redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[uuid-redacted]");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function dbQuery(sql, attempt = 0) {
  const cliPath = path.join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
  try {
    const { stdout, stderr } = await execFile(process.execPath, [cliPath, "db", "query", "--linked", sql], {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (stderr?.trim()) throw new Error(`Supabase CLI error: ${sanitize(stderr)}`);
    const parsed = JSON.parse(stdout);
    return parsed.rows ?? [];
  } catch (error) {
    const detail = error?.stderr || error?.stdout || error?.message || error;
    if (attempt < 2 && /Transport error/i.test(String(detail))) {
      await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1)));
      return dbQuery(sql, attempt + 1);
    }
    throw new Error(`Supabase CLI failed: ${sanitize(detail)}`);
  }
}

async function inspectUrl(browser, rawUrl, expected) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeoutMs);
  page.setDefaultNavigationTimeout(CONFIG.timeoutMs);
  const evidence = {
    name: expected.name,
    startedAtUtc: new Date().toISOString(),
    startRoute: sanitize(rawUrl),
    finalRoute: null,
    status: "FAIL",
    documentResponses: [],
    console: [],
    pageErrors: [],
    requestFailures: [],
  };
  page.on("response", (response) => {
    const request = response.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      evidence.documentResponses.push({ status: response.status(), route: sanitize(response.url()) });
    }
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      evidence.console.push({ type: message.type(), text: sanitize(message.text()) });
    }
  });
  page.on("pageerror", (error) => evidence.pageErrors.push(sanitize(error?.stack ?? error)));
  page.on("requestfailed", (request) => evidence.requestFailures.push({
    route: sanitize(request.url()),
    error: sanitize(request.failure()?.errorText ?? "unknown"),
  }));
  try {
    const response = await page.goto(rawUrl, { waitUntil: "networkidle2" });
    const body = await page.$eval("body", (node) => node.innerText);
    const finalUrl = new URL(page.url());
    evidence.finalRoute = sanitize(page.url());
    evidence.finalHttpStatus = response?.status() ?? null;
    evidence.authCookieCount = (await page.cookies()).filter((cookie) => cookie.name.includes("auth-token")).length;
    evidence.bodyExcerpt = sanitize(body.slice(0, 1_200));
    evidence.visible = expected.visible.every((text) => body.includes(text));
    evidence.absent = expected.absent.every((text) => !body.includes(text));
    evidence.finalOriginMatches = finalUrl.origin === expected.finalOrigin;
    evidence.status = evidence.visible && evidence.absent && evidence.finalOriginMatches ? "PASS" : "FAIL";
  } catch (error) {
    evidence.error = sanitize(error?.stack ?? error);
  } finally {
    evidence.finishedAtUtc = new Date().toISOString();
    await context.close();
  }
  return evidence;
}

async function main() {
  await mkdir(CONFIG.outputRoot, { recursive: true });
  const startedAtUtc = new Date().toISOString();
  const runLabel = startedAtUtc.replace(/[-:.TZ]/g, "").slice(0, 14);
  const packetFresh = crypto.randomUUID();
  const packetLegacy = crypto.randomUUID();
  const tokenFreshId = crypto.randomUUID();
  const tokenLegacyId = crypto.randomUUID();
  const signerFreshId = crypto.randomUUID();
  const signerLegacyId = crypto.randomUUID();
  const rawFresh = crypto.randomBytes(32).toString("base64url");
  const rawLegacy = crypto.randomBytes(32).toString("base64url");
  const markerFresh = `SYNTHETIC QA SIGNING FRESH ${runLabel}`;
  const markerLegacy = `SYNTHETIC QA SIGNING LEGACY ${runLabel}`;
  const fixtureIds = [packetFresh, packetLegacy];
  const evidence = {
    startedAtUtc,
    finishedAtUtc: null,
    deploymentId: CONFIG.deploymentId,
    chromeVersion: null,
    status: "FAIL",
    fixtureSetup: null,
    checks: [],
    databaseVerification: null,
    cleanup: null,
  };
  let browser;
  try {
    const setupSql = `
      with realtor as (
        select p.id from public.profiles p join auth.users u on u.id=p.id
        where u.raw_app_meta_data->>'qa_label'='qa-active-realtor' limit 1
      ), packets as (
        insert into public.lease_packets(id,created_by,status,property_address,property_unit,district,province,department,rental_amount,deposit_amount,lease_start_date,lease_end_date,document_hash)
        select '${packetFresh}'::uuid,id,'signing','${markerFresh}','QA-1','Miraflores','LIMA','LIMA',1000::numeric,1000::numeric,'2026-10-01'::date,'2027-09-30'::date,repeat('a',64) from realtor
        union all
        select '${packetLegacy}'::uuid,id,'signing','${markerLegacy}','QA-2','Miraflores','LIMA','LIMA',1000::numeric,1000::numeric,'2026-10-01'::date,'2027-09-30'::date,repeat('b',64) from realtor
        returning id
      ), tokens as (
        insert into public.signing_tokens(id,token_hash,packet_id,signer_email,signer_whatsapp,signer_dni,signer_full_name,role_in_lease,status,expires_at)
        values
          ('${tokenFreshId}','${hashToken(rawFresh)}','${packetFresh}','delivered@resend.dev','+51000000001','00000001','SYNTHETIC QA FRESH SIGNER','landlord','pending',now()+interval '2 hours'),
          ('${tokenLegacyId}','${hashToken(rawLegacy)}','${packetLegacy}','bounced@resend.dev','+51000000002','00000002','SYNTHETIC QA LEGACY SIGNER','renter','pending',now()+interval '2 hours')
        returning id
      )
      insert into public.packet_signers(id,packet_id,signing_token_id,role_in_lease,signer_email,signer_full_name,signer_dni,signer_whatsapp,status)
      values
        ('${signerFreshId}','${packetFresh}','${tokenFreshId}','landlord','delivered@resend.dev','SYNTHETIC QA FRESH SIGNER','00000001','+51000000001','invited'),
        ('${signerLegacyId}','${packetLegacy}','${tokenLegacyId}','renter','bounced@resend.dev','SYNTHETIC QA LEGACY SIGNER','00000002','+51000000002','invited');
      select count(*)::int as fixture_count from public.lease_packets where id in ('${packetFresh}','${packetLegacy}');
    `;
    const setupRows = await dbQuery(setupSql);
    evidence.fixtureSetup = { fixtureCount: setupRows.at(-1)?.fixture_count ?? null };

    browser = await puppeteer.launch({
      executablePath: CONFIG.chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    evidence.chromeVersion = await browser.version();
    evidence.checks.push(await inspectUrl(browser, `${CONFIG.appOrigin}/firma/${rawFresh}`, {
      name: "fresh-production-link",
      finalOrigin: CONFIG.appOrigin,
      visible: ["Firma de contrato", markerFresh, "Comenzar verificación"],
      absent: [markerLegacy, "enlace no es válido"],
    }));
    evidence.checks.push(await inspectUrl(browser, `${CONFIG.appOrigin}/firma/${rawFresh}`, {
      name: "copied-link-second-clean-context",
      finalOrigin: CONFIG.appOrigin,
      visible: ["Firma de contrato", markerFresh, "Comenzar verificación"],
      absent: [markerLegacy, "enlace no es válido"],
    }));
    evidence.checks.push(await inspectUrl(browser, `${CONFIG.apexOrigin}/firma/${rawLegacy}`, {
      name: "legacy-apex-link-canonicalization",
      finalOrigin: CONFIG.appOrigin,
      visible: ["Firma de contrato", markerLegacy, "Comenzar verificación"],
      absent: [markerFresh, "enlace no es válido"],
    }));
    evidence.checks.push(await inspectUrl(browser, `${CONFIG.demoOrigin}/firma/${rawFresh}`, {
      name: "production-token-rejected-by-demo",
      finalOrigin: CONFIG.demoOrigin,
      visible: ["Enlace de firma inválido o expirado"],
      absent: [markerFresh, markerLegacy],
    }));
    evidence.checks.push(await inspectUrl(browser, `${CONFIG.appOrigin}/firma/tok-carlos-larco-001`, {
      name: "demo-token-rejected-by-production",
      finalOrigin: CONFIG.appOrigin,
      visible: ["Enlace de firma inválido"],
      absent: [markerFresh, markerLegacy],
    }));
    evidence.checks.push(await inspectUrl(browser, `${CONFIG.demoOrigin}/firma/tok-carlos-larco-001`, {
      name: "demo-token-valid-only-on-demo",
      finalOrigin: CONFIG.demoOrigin,
      visible: ["Modo demostración", "Verificación de identidad"],
      absent: [markerFresh, markerLegacy, "enlace no es válido"],
    }));

    const verifyRows = await dbQuery(`
      select count(*)::int as token_count,
        count(*) filter (where status='pending' and otp_verified_at is null and consumed_at is null)::int as unchanged_count
      from public.signing_tokens where id in ('${tokenFreshId}','${tokenLegacyId}');
    `);
    evidence.databaseVerification = verifyRows[0] ?? null;
    evidence.status = evidence.checks.every((check) => check.status === "PASS")
      && evidence.databaseVerification?.token_count === 2
      && evidence.databaseVerification?.unchanged_count === 2
      ? "PASS"
      : "FAIL";
  } catch (error) {
    evidence.error = sanitize(error?.stack ?? error);
  } finally {
    if (browser) await browser.close();
    try {
      const cleanupRows = await dbQuery(`
        delete from public.packet_signers where packet_id in ('${packetFresh}','${packetLegacy}');
        delete from public.signing_tokens where id in ('${tokenFreshId}','${tokenLegacyId}');
        delete from public.lease_packets where id in ('${packetFresh}','${packetLegacy}');
        select count(*)::int as remaining from public.lease_packets where id in ('${packetFresh}','${packetLegacy}');
      `);
      evidence.cleanup = { remaining: cleanupRows.at(-1)?.remaining ?? null };
    } catch (cleanupError) {
      evidence.cleanup = { error: sanitize(cleanupError?.message ?? cleanupError) };
      evidence.status = "PARTIAL";
    }
    evidence.finishedAtUtc = new Date().toISOString();
    const outputPath = path.join(CONFIG.outputRoot, `evidence-${startedAtUtc.replace(/[:.]/g, "-")}.json`);
    await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ ...evidence, evidencePath: outputPath }, null, 2)}\n`);
  }
  if (evidence.status !== "PASS") process.exitCode = 1;
}

await main();
