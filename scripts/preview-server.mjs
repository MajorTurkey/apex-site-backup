import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".apk": "application/vnd.android.package-archive",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
};

function loadConfig() {
  return JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
}

function hasExtension(pathname) {
  const last = pathname.split("/").filter(Boolean).pop() || "";
  return last.includes(".");
}

function safeFile(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const full = resolve(root, decoded.replace(/^\/+/, ""));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

function applyHeaders(config, pathname, headers) {
  for (const rule of config.headers || []) {
    if (rule.source === pathname) {
      for (const header of rule.headers) headers[header.key] = header.value;
    }
  }
  return headers;
}

export function startPreview() {
  const config = loadConfig();
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let pathname = url.pathname;
    const search = url.search;
    if (
      config.trailingSlash === true &&
      pathname !== "/" &&
      !pathname.endsWith("/") &&
      !hasExtension(pathname)
    ) {
      res.writeHead(308, { Location: `${pathname}/${search}` });
      res.end();
      return;
    }
    const rewrite = (config.rewrites || []).find((rule) => rule.source === pathname);
    if (rewrite && !existsSync(safeFile(pathname) || "")) pathname = rewrite.destination;
    let file = safeFile(pathname);
    if (file && existsSync(file) && statSync(file).isDirectory()) {
      file = join(file, "index.html");
    }
    if (!file || !existsSync(file) || statSync(file).isDirectory()) {
      const missing = readFileSync(join(root, "404.html"));
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(missing);
      return;
    }
    const body = readFileSync(file);
    const headers = applyHeaders(config, url.pathname, {
      "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": body.length,
    });
    res.writeHead(200, headers);
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        raw: server,
        close: () => server.close(),
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const preview = await startPreview();
  console.log(preview.url);
}
