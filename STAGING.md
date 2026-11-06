# Stage the current Apex site on Vercel

The files in this repository are the current public site. Commit `8c6e07fac82a623ce24c71c51eb78bec8c2f0d77` (1 Nov 2026, 18:44 UTC) matches live GitHub Pages byte for byte, including the homepage, `/desk/`, `/phone/`, `request.html`, `manifest.webmanifest`, and both APK downloads.

Do not promote a deployment, attach a domain, or change DNS from this change. Production DNS still points at GitHub Pages. Apex Suite is a separate product and is not part of this site.

## What is current

| URL | Current behavior |
| --- | --- |
| `/` | Static "File a job" page. Unregisters any service workers on this origin. Links to `request.html?door=…`. |
| `/desk/` | Jack's Desk. Jobs stay in `localStorage` key `jacks-desk-local` on this origin. |
| `/phone/` | Field Phone. Sign-in and jobs stay in `localStorage` key `apex-field-phone` on this origin. |
| `/request.html?door=` | Mailto form. `/request` and `/request/` serve the same file. |
| `/manifest.webmanifest` | Homepage install manifest. Scope `./`, icons `icons/stone-192.png` and `icons/stone-512.png`. |
| `/Jacks-Desk.apk` | Android wrapper. Online it opens `https://apexfieldservicellc.com/desk/`. |
| `/Apex-Field-Phone.apk` | Android wrapper. Online it opens `https://apexfieldservicellc.com/phone/`. |

There is no `/sw.js`, `/desk-sw.js`, or `/downloads/` directory. That is the current site. A missing worker returns the 404 page.

## What not to restore

`https://apex-field-site.vercel.app` and `https://apex-desk-eta.vercel.app` are older apps. Checked 6 Nov 2026, they return 200 for `/` and 404 for `/desk/` and `/phone/`. The older app also publishes `/office`, `/site`, `/sw.js`, and `/desk-sw.js`. Those workers only pass the request to the network; they do not cache a copy of the old interface. Putting that app back would replace the pages the installed APKs open. This repository does not contain that app, and this change does not copy it.

`https://apex-desk.vercel.app` is an unrelated starter app. Leave it alone.

## Preview deploy

Target the existing project only:

- Project: `apex-field-site`
- Project id: `prj_iNFb9VxAfMfQw86eFYGnLSl6LisK`
- Team id: `team_3hvTm6PvjglsYDXjJqHy6GCK`

`vercel.json` forces a static publish of this directory (`framework: null`, empty install and build, `outputDirectory: "."`). That keeps a previously saved Vite or Next build from running. `trailingSlash: true` keeps `/desk/` and `/phone/` on those exact paths, because the APKs request the trailing slash. `cleanUrls` stays off so `request.html` is not redirected away. No production flag, no domain, no alias of `apexfieldservicellc.com`.

```bash
npx vercel@latest deploy . --scope team_3hvTm6PvjglsYDXjJqHy6GCK --project apex-field-site --yes
```

Do not pass `--prod`. Do not run `vercel promote`. The preview hostname is a different origin, so it will not show the tablets' saved jobs. Do not type real customer data into the preview.

Then run the read-only check:

```bash
node scripts/check-parity.mjs https://THE-PREVIEW-URL
```

`node --test` checks the Nov 1 bytes, the two storage keys, the APK entry URLs, and the same contract against a local preview.

## GitHub backup limits

Keep this repository and GitHub Pages. Nothing here deletes them. `.nojekyll` and `CNAME` stay so Pages can keep serving `apexfieldservicellc.com` until DNS is changed on purpose.

The largest file is `Apex-Field-Phone.apk` at 1,382,204 bytes. `Jacks-Desk.apk` is 62,053 bytes. The site is under 2 MB. GitHub's file limit is 100 MB and the Pages recommendation is under 1 GB, so the current binaries fit. No Git LFS or external file host is required.

## Installed-app notes

- APKs keep calling the production origin. A preview URL does not update installed apps. After a later cutover, the same `/desk/` and `/phone/` paths have to return these pages.
- Jack's Desk APK injects folder and Word save hooks, but the current desk page has no matching form. Those hooks already do nothing on the live site. The page still stores jobs under `jacks-desk-local`.
- Field Phone's offline screen inside the APK is an older bundled copy. It is not the website. Online, the APK shows `/phone/`.
- Opening the homepage clears service-worker registrations for this origin. The desk and phone pages do not register one. A device that only opens an APK can keep an old network-passthrough registration until someone opens the homepage; it still loads the current page from the network.
- An old home-screen icon used `/icons/icon-192.png`, which this site does not have. The current manifest uses the stone icons. The icon can look stale until that home-screen shortcut is reinstalled.
- `www.apexfieldservicellc.com` currently redirects to the apex host at GitHub. Recreate that redirect at cutover. This change does not.

## Rollback

While DNS stays on GitHub Pages, rollback is to ignore or delete the preview deployment. The live site is unchanged.

If a later production promotion is wrong, promote the previous `apex-field-site` deployment again, or point the domain back at GitHub Pages. Do not delete the GitHub repository as part of either step.
