# jurisbook-chrome

The single-source **federated chrome** (header + footer + CSS + JS + i18n) for all
JurisBook web apps, plus the Vite plugin that injects it. Every app imports this
repo as a **git submodule** so there is exactly one source of truth — no more
copy-pasted `chrome/` folders that drift between repos.

## What's inside

| File | Purpose |
|---|---|
| `header.html` / `footer.html` | Chrome partials (pure markup). Contain `__CHROME_LOGO_SRC__` + the `<!-- @chrome-header-extras -->` slot. |
| `chrome.css` / `chrome.js` | Chrome styles + behaviour (sticky header, dropdowns, mobile menu, i18n application, footer-form fallback). |
| `chrome.i18n.json` | ES/EN strings for every `data-i18n` key used in the chrome. |
| `vite-plugin-chrome.ts` | The importer — injects the chrome into each HTML entry at build time. |

## Consume it in an app (git submodule)

From the app repo root:

```bash
git submodule add https://github.com/sethmalvarez/jurisbook-chrome.git chrome
git commit -m "Add jurisbook-chrome submodule (shared header/footer)"
```

Then in `vite.config.ts`:

```ts
import { chromePlugin } from "./chrome/vite-plugin-chrome";

export default defineConfig({
  plugins: [
    chromePlugin({
      siteBase: "https://jurisbook.com",     // prefixes root-relative nav links so they resolve cross-domain
      logoSrc: "/logos/JB_Logo1_NB.png",     // this app's static logo path
      headerExtrasPath: "header-extras.html", // OPTIONAL repo-local slot (e.g. store cart)
    }),
  ],
});
```

And put the markers in your HTML entry:

```html
<!-- @chrome-header -->
<!-- @chrome-footer -->
```

### Extension slot (e.g. the store cart)

Repo-specific UI does **not** belong in this submodule. Put it in a local file
(e.g. `header-extras.html` at the app root) and pass `headerExtrasPath`. It is
injected verbatim at `<!-- @chrome-header-extras -->`, between the language
toggle and the mobile-menu button. Apps with nothing to add simply omit the
option (the marker collapses to empty).

## Why `siteBase`

The chrome's nav links are root-relative (`/jb-lex-ai.html`, `/#nosotros`). On
the store (`store.jurisbook.com`) those pages don't exist, so they 404. The
plugin rewrites `href="/..."` → `href="${siteBase}/..."` so the nav always points
at the main site, from any domain. Same-page anchors (`#contacto`) and absolute
URLs are left untouched.

## Updating the chrome

1. Edit files **here** (the single source).
2. Commit + push.
3. In each consuming app: `git submodule update --remote chrome`, then commit
   the new submodule pointer and redeploy.

## Deploy note (Hostinger)

Submodules are NOT fetched by a plain `git clone`. Each consuming app must init
the submodule before building. Add a `prebuild` script to `package.json`:

```json
"scripts": { "prebuild": "git submodule update --init --recursive", "build": "vite build" }
```

`npm run build` will then populate `chrome/` even on a fresh clone.
