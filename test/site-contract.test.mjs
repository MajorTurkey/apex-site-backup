import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { once } from "node:events";
import { test } from "node:test";
import { startPreview } from "../scripts/preview-server.mjs";
import { checkParity } from "../scripts/check-parity.mjs";

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const CURRENT = {
  "index.html": "78f39e2aad211cfa77f3390dc99f526d094d4dd483279f6ff10f450552502713",
  "desk/index.html": "bf591668993d5678b6d5a04ff2d6878dcc5e13ea523224a7a751fdc858edc925",
  "phone/index.html": "c26fedaa26e33a8cf9c49a636b4c0858474fd7fcb0bc6918ae033b550c83b854",
  "request.html": "0c9dc0dbb07138926abe92295a1f927f1b6f271175d0cf059449048162133621",
  "manifest.webmanifest": "b2e107a0a35f64b2a68810001e4d62fdf0c4f1cb1a677b88aad6330949b10f27",
  "404.html": "dc234185c8dcd5f76f882bca42e26900cb6a5f26ac28797cbea1b5131796e174",
  "Jacks-Desk.apk": "3d4f64a28d5b6ecbe4d3c9530b4718f307f3d31be1de54e6b053a5a57da96e80",
  "Apex-Field-Phone.apk": "0b6d3871cbbd8b78896a833e6c94ef2d8e28ffff1d82c99b52743aae9c954185",
  CNAME: "68d3c7a510bbeb60fc0767f367bf7016973d2394439e6246c5fb31cc157a17ad",
};

test("current Nov 1 pages, manifest, and downloads are unchanged", () => {
  for (const [path, hash] of Object.entries(CURRENT)) {
    assert.equal(sha256(path), hash, path);
  }
  assert.equal(readFileSync("CNAME", "utf8").trim(), "apexfieldservicellc.com");
  assert.equal(existsSync(".nojekyll"), true);
});

test("desk and phone keep separate local storage keys and do not register a worker", () => {
  const desk = readFileSync("desk/index.html", "utf8");
  const phone = readFileSync("phone/index.html", "utf8");
  const home = readFileSync("index.html", "utf8");
  assert.match(desk, /var KEY="jacks-desk-local"/);
  assert.match(phone, /var KEY = "apex-field-phone"/);
  assert.equal(desk.includes("apex-field-phone"), false);
  assert.equal(phone.includes("jacks-desk-local"), false);
  assert.match(home, /serviceWorker\.getRegistrations\(\)/);
  assert.match(home, /r\.unregister\(\)/);
  assert.equal(desk.includes("serviceWorker"), false);
  assert.equal(phone.includes("serviceWorker"), false);
  assert.equal(existsSync("sw.js"), false);
  assert.equal(existsSync("desk-sw.js"), false);
  assert.equal(existsSync("service-worker.js"), false);
});

test("installed apps still target the live desk and phone paths", () => {
  const phoneApk = readFileSync("Apex-Field-Phone.apk");
  const deskApk = readFileSync("Jacks-Desk.apk");
  assert.ok(phoneApk.includes(Buffer.from("https://apexfieldservicellc.com/phone/")));
  assert.ok(deskApk.includes(Buffer.from("https://apexfieldservicellc.com/desk/")));
});

test("vercel config serves this static site without a legacy build or external rewrite", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, "");
  assert.equal(config.installCommand, "");
  assert.equal(config.outputDirectory, ".");
  assert.equal(config.cleanUrls, false);
  assert.equal(config.trailingSlash, true);
  assert.equal(Object.hasOwn(config, "rewrites"), true);
  const destinations = (config.rewrites || []).map((rule) => rule.destination);
  for (const destination of destinations) {
    assert.equal(destination.startsWith("/"), true, destination);
    assert.equal(destination.includes("://"), false, destination);
  }
  const sources = new Set((config.rewrites || []).map((rule) => rule.source));
  for (const source of ["/request", "/request/", "/index", "/index/", "/404", "/404/"]) {
    assert.equal(sources.has(source), true, source);
  }
  const headerSources = new Set((config.headers || []).map((rule) => rule.source));
  for (const source of ["/Jacks-Desk.apk", "/Apex-Field-Phone.apk", "/manifest.webmanifest"]) {
    assert.equal(headerSources.has(source), true, source);
  }
  const apk = config.headers.find((rule) => rule.source === "/Apex-Field-Phone.apk");
  const manifest = config.headers.find((rule) => rule.source === "/manifest.webmanifest");
  assert.equal(
    apk.headers.find((header) => header.key === "Content-Type").value,
    "application/vnd.android.package-archive",
  );
  assert.equal(
    manifest.headers.find((header) => header.key === "Content-Type").value,
    "application/manifest+json; charset=utf-8",
  );
});

test("local preview matches the current path, type, and download contract", async () => {
  const server = await startPreview();
  try {
    const result = await checkParity(server.url);
    assert.deepEqual(result.failures, []);
  } finally {
    server.close();
    await once(server.raw, "close");
  }
});
