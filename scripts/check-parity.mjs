const CHECKS = [
  {
    path: "/",
    status: 200,
    type: "text/html",
    includes: ["File a job", "request.html?door=survey", "serviceWorker.getRegistrations", "r.unregister"],
  },
  {
    path: "/desk/",
    status: 200,
    type: "text/html",
    includes: ["jacks-desk-local", "Jack's Desk"],
    excludes: ["serviceWorker.register", "apex-field-phone"],
  },
  {
    path: "/phone/",
    status: 200,
    type: "text/html",
    includes: ["apex-field-phone", "Field phone"],
    excludes: ["serviceWorker.register", "jacks-desk-local"],
  },
  { path: "/desk", redirectPath: "/desk/" },
  { path: "/phone", redirectPath: "/phone/" },
  {
    path: "/request.html?door=survey",
    status: 200,
    type: "text/html",
    includes: ["Survey", "Send to Jack"],
  },
  {
    path: "/request?door=survey",
    reachable: { includes: ["Survey", "Send to Jack"] },
  },
  {
    path: "/manifest.webmanifest",
    status: 200,
    type: "application/manifest+json",
    includes: ["Apex Field Service", "icons/stone-192.png", "icons/stone-512.png"],
  },
  {
    path: "/Jacks-Desk.apk",
    status: 200,
    type: "application/vnd.android.package-archive",
    minBytes: 60000,
  },
  {
    path: "/Apex-Field-Phone.apk",
    status: 200,
    type: "application/vnd.android.package-archive",
    minBytes: 1300000,
  },
  { path: "/logo.svg", status: 200, type: "image/svg" },
  { path: "/official-logo.png", status: 200, type: "image/png" },
  { path: "/icons/stone-32.png", status: 200, type: "image/png" },
  { path: "/icons/stone-192.png", status: 200, type: "image/png" },
  { path: "/icons/stone-512.png", status: 200, type: "image/png" },
  { path: "/og.jpg", status: 200, type: "image/jpeg" },
  { path: "/apex-banner.png", status: 200, type: "image/png" },
  { path: "/sw.js", status: 404 },
  { path: "/desk-sw.js", status: 404 },
  { path: "/service-worker.js", status: 404 },
  { path: "/phone.webmanifest", status: 404 },
  { path: "/downloads/", status: 404 },
  {
    path: "/no-such-page.html",
    status: 404,
    type: "text/html",
    includes: ["The online forms are offline"],
  },
];

function locationPath(value) {
  if (!value) return "";
  try {
    const url = new URL(value, "https://apexfieldservicellc.com");
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

export async function checkParity(base) {
  const root = base.replace(/\/$/, "");
  const failures = [];
  for (const check of CHECKS) {
    const response = await fetch(`${root}${check.path}`, { redirect: "manual" });
    const body = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get("content-type") || "";
    const location = locationPath(response.headers.get("location"));
    const problems = [];
    if (check.redirectPath) {
      if (![301, 308].includes(response.status)) problems.push(`status ${response.status}, expected 301 or 308`);
      const expected = new URL(check.redirectPath, "https://apexfieldservicellc.com");
      const actual = new URL(location || "/", "https://apexfieldservicellc.com");
      if (actual.pathname !== expected.pathname) problems.push(`location ${location}`);
    } else if (check.reachable) {
      let finalResponse = response;
      let finalBody = body;
      if ([301, 302, 307, 308].includes(response.status)) {
        const next = location.startsWith("/") ? `${root}${location}` : response.headers.get("location");
        finalResponse = await fetch(next, { redirect: "manual" });
        finalBody = Buffer.from(await finalResponse.arrayBuffer());
        if ([301, 302, 307, 308].includes(finalResponse.status)) {
          problems.push(`second redirect to ${finalResponse.headers.get("location")}`);
        }
      }
      if (finalResponse.status !== 200) problems.push(`final status ${finalResponse.status}`);
      const text = finalBody.toString("utf8");
      for (const needle of check.reachable.includes) {
        if (!text.includes(needle)) problems.push(`missing ${needle}`);
      }
    } else if (response.status !== check.status) {
      problems.push(`status ${response.status}, expected ${check.status}`);
    }
    if (check.type && response.status === check.status && !type.includes(check.type)) {
      problems.push(`type ${type}`);
    }
    if (check.minBytes && body.length < check.minBytes) problems.push(`bytes ${body.length}`);
    if (check.includes || check.excludes) {
      const text = body.toString("utf8");
      for (const needle of check.includes || []) {
        if (!text.includes(needle)) problems.push(`missing ${needle}`);
      }
      for (const needle of check.excludes || []) {
        if (text.includes(needle)) problems.push(`unexpected ${needle}`);
      }
    }
    if (problems.length) failures.push({ path: check.path, problems });
  }
  return { failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[2];
  if (!base) {
    console.error("Usage: node scripts/check-parity.mjs https://host");
    process.exit(2);
  }
  const result = await checkParity(base);
  if (result.failures.length) {
    for (const failure of result.failures) {
      console.error(`${failure.path}: ${failure.problems.join("; ")}`);
    }
    process.exit(1);
  }
  console.log(`parity ok ${base}`);
}
