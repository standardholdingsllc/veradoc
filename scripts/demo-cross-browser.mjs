import puppeteer from "puppeteer-core";

const baseUrl = process.env.DEMO_BASE_URL ?? "http://demo.localhost:3000";
const executablePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browserArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--no-proxy-server"];
if (new URL(baseUrl).hostname === "demo.localhost") {
  browserArgs.push("--host-resolver-rules=MAP demo.localhost 127.0.0.1");
}
if (process.env.DEMO_BROWSER_MAP_HOST === "1") {
  browserArgs.push("--host-resolver-rules=MAP demo.veradoc.pe 127.0.0.1");
}

function localizeDemoUrl(value, suffix) {
  if (process.env.DEMO_PATH_PREFIX !== "1") return value;
  const source = new URL(value);
  return `${baseUrl}${suffix(source)}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function workspace(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/demo/workspace", { cache: "no-store" });
    if (!response.ok) throw new Error(`workspace:${response.status}`);
    return response.json();
  });
}

async function waitFor(check, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for shared demo state");
}

async function closeBrowser(browserInstance) {
  let timeout;
  try {
    await Promise.race([
      browserInstance.close(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Timed out closing demo browser")), 5_000);
      }),
    ]);
  } catch (error) {
    browserInstance.process()?.kill();
    console.warn(error instanceof Error ? error.message : "Forced demo browser shutdown");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

let browser;
try {
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: browserArgs,
  });
  const presenterContext = await browser.createBrowserContext();
  const signerContext = await browser.createBrowserContext();
  const notaryContext = await browser.createBrowserContext();
  const presenter = await presenterContext.newPage();
  const signer = await signerContext.newPage();
  const notary = await notaryContext.newPage();

  await presenter.goto(`${baseUrl}/agente`, { waitUntil: "domcontentloaded" });
  let initial;
  await waitFor(async () => {
    try {
      initial = await workspace(presenter);
      return true;
    } catch {
      return false;
    }
  });
  assert(initial.accessRole === "presenter", "Browser A did not receive presenter scope");
  const pending = initial.snapshot.packets
    .flatMap((packet) => packet.signers.map((entry) => ({ packet, signer: entry })))
    .find(({ signer: entry }) => entry.status === "identity_uploaded");
  assert(pending, "No resumable demo signer fixture found");
  const generatedSignerUrl = initial.links.signers[`${pending.packet.id}:${pending.signer.id}`];
  const signerUrl = generatedSignerUrl
    ? localizeDemoUrl(generatedSignerUrl, (url) => `/firma/${url.pathname.split("/").at(-1)}`)
    : undefined;
  assert(signerUrl, "Presenter did not receive a signer URL");

  await signer.goto(signerUrl, { waitUntil: "domcontentloaded" });
  const signerMutationStatus = await signer.evaluate(async () => {
    const path = window.location.pathname.split("/");
    const token = path[path.indexOf("firma") + 1];
    const response = await fetch(`/api/demo/signers/${encodeURIComponent(token)}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "complete_liveness" }),
    });
    return response.status;
  });
  assert(signerMutationStatus === 200, "Browser B could not update signer progress");

  let observedSignerStatus;
  await waitFor(async () => {
    const current = await workspace(presenter);
    observedSignerStatus = current.snapshot.packets
      .find((packet) => packet.id === pending.packet.id)
      ?.signers.find((entry) => entry.id === pending.signer.id)?.status;
    if (observedSignerStatus !== "identity_verified_demo") {
      console.log("Presenter sees signer status:", observedSignerStatus);
    }
    return observedSignerStatus === "identity_verified_demo";
  });

  const notaryUrl = localizeDemoUrl(
    initial.links.notary,
    (url) => `/notario#demo_access=${encodeURIComponent(new URLSearchParams(url.hash.slice(1)).get("demo_access") ?? "")}`,
  );
  await notary.goto(notaryUrl, { waitUntil: "domcontentloaded" });
  await waitFor(async () => !new URLSearchParams(new URL(notary.url()).hash.slice(1)).has("demo_access"));
  const notaryState = await workspace(notary);
  assert(notaryState.accessRole === "notary", "Browser C did not receive notary scope");
  assert(notaryState.workspaceId === initial.workspaceId, "Browser C received another workspace");
  const reviewPacket = notaryState.snapshot.packets[0];
  reviewPacket.notaryReview = {
    status: "pending",
    reviewChecklist: [],
    observations: "Verificación desde navegador C",
  };
  reviewPacket.updatedAt = new Date().toISOString();
  const notaryWrite = await notary.evaluate(async ({ version, snapshot }) => {
    const response = await fetch("/api/demo/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, snapshot }),
    });
    const result = await response.json();
    return { status: response.status, observations: result.snapshot?.packets?.[0]?.notaryReview?.observations };
  }, { version: notaryState.version, snapshot: notaryState.snapshot });
  assert(notaryWrite.status === 200, "Browser C could not save notary review state");
  assert(notaryWrite.observations === "Verificación desde navegador C", "Notary write did not retain review");

  await waitFor(async () => {
    const current = await workspace(presenter);
    assert(current.workspaceId === initial.workspaceId, "Browser A switched workspace");
    return current.snapshot.packets[0].notaryReview?.observations === "Verificación desde navegador C";
  });

  const resetStatus = await presenter.evaluate(async () =>
    (await fetch("/api/demo/workspace", { method: "DELETE" })).status,
  );
  assert(resetStatus === 204, "Presenter reset did not delete the workspace");
  const revokedStatus = await signer.evaluate(async () => {
    const path = window.location.pathname.split("/");
    const token = path[path.indexOf("firma") + 1];
    return (await fetch(`/api/demo/signers/${encodeURIComponent(token)}`, { cache: "no-store" })).status;
  });
  assert(revokedStatus === 404, "Signer capability remained valid after reset");

  console.log("Demo cross-browser acceptance passed (A presenter → B signer → C notary → reset).");
} finally {
  if (browser) await closeBrowser(browser);
}
