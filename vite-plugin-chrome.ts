import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import type { Plugin } from 'vite';

/**
 * vite-plugin-chrome — the JurisBook federated chrome importer.
 *
 * The chrome (header/footer/CSS/JS/i18n) lives in a SINGLE source repo
 * (`jurisbook-chrome`) that each app imports as a git submodule at <root>/chrome.
 * This plugin injects it into every HTML entry at build time at the markers:
 *
 *     <!-- @chrome-header -->
 *     <!-- @chrome-footer -->
 *
 * Per-repo configuration (ChromePluginOptions):
 *   - siteBase:         origin prepended to root-relative nav links, e.g.
 *                       "https://jurisbook.com". Makes the nav work from ANY domain
 *                       (the store lives on store.jurisbook.com, the product pages
 *                       on jurisbook.com). Without it, relative links 404 off-origin.
 *   - logoSrc:          header brand image URL (each repo hosts its logo at its own
 *                       static path). Default "/logos/JB_Logo1_NB.png".
 *   - headerExtrasPath: repo-local markup injected at <!-- @chrome-header-extras -->
 *                       (e.g. the store cart). Lives in the CONSUMING repo, NOT in
 *                       this submodule, so repo-specific UI never pollutes the
 *                       shared chrome and cannot drift across repos.
 *
 * Output is fully static (inlined <style> + <script> + window.__CHROME_I18N__);
 * served HTML has no runtime dependency across repos.
 *
 * NOTE: chrome partials (header.html, footer.html) MUST be pure markup — no
 * leading HTML comment. Keep partial docs in README.md.
 */
export interface ChromePluginOptions {
  /** Path to the chrome folder (the submodule). Defaults to <vite root>/chrome. */
  chromeDir?: string;
  /** Origin prepended to root-relative nav links so they resolve cross-domain. */
  siteBase?: string;
  /** Header brand image URL. */
  logoSrc?: string;
  /** Repo-local path (relative to vite root, or absolute) to header-extras markup. */
  headerExtrasPath?: string;
}

function readSafe(p: string): string {
  return existsSync(p) ? readFileSync(p, 'utf-8') : '';
}

/**
 * Make root-relative links absolute (href="/..." -> href="${siteBase}/...").
 * Leaves same-page anchors (href="#..."), protocol-relative (href="//..."), and
 * already-absolute URLs untouched.
 */
function absolutize(html: string, siteBase: string): string {
  if (!siteBase) return html;
  const base = siteBase.replace(/\/+$/, '');
  return html.replace(/href="(\/(?!\/)[^"]*)"/g, `href="${base}$1"`);
}

export function chromePlugin(options: ChromePluginOptions = {}): Plugin {
  let dir: string;
  let root: string;

  return {
    name: 'jurisbook-chrome',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      dir = options.chromeDir ? resolve(options.chromeDir) : join(config.root, 'chrome');
    },
    transformIndexHtml(html) {
      if (!html.includes('@chrome-header') && !html.includes('@chrome-footer')) {
        return html;
      }

      const headerPartial = readSafe(join(dir, 'header.html'));
      const footerPartial = readSafe(join(dir, 'footer.html'));
      const css = readSafe(join(dir, 'chrome.css'));
      const js = readSafe(join(dir, 'chrome.js'));
      const i18nRaw = readSafe(join(dir, 'chrome.i18n.json'));

      // Extension slot lives in the CONSUMING repo (outside the submodule).
      const extrasAbs = options.headerExtrasPath
        ? (isAbsolute(options.headerExtrasPath)
            ? options.headerExtrasPath
            : join(root, options.headerExtrasPath))
        : '';
      const headerExtras = extrasAbs ? readSafe(extrasAbs) : '';

      let i18nObj: Record<string, unknown> = {};
      if (i18nRaw) {
        try {
          const parsed = JSON.parse(i18nRaw);
          if (parsed && typeof parsed === 'object') {
            delete parsed._comment;
            i18nObj = parsed;
          }
        } catch (err) {
          this.warn(`[chrome] Failed to parse chrome.i18n.json: ${(err as Error).message}`);
        }
      }

      const siteBase = options.siteBase || '';

      let out = html;
      out = out.replace(/<!--\s*@chrome-header\s*-->/g, absolutize(headerPartial, siteBase));
      out = out.replace(/<!--\s*@chrome-footer\s*-->/g, absolutize(footerPartial, siteBase));
      // Optional header-extras slot (e.g. store cart). Removed (empty) if no partial.
      out = out.replace(/<!--\s*@chrome-header-extras\s*-->/g, headerExtras);
      // Per-repo logo path.
      const logoSrc = options.logoSrc || '/logos/JB_Logo1_NB.png';
      out = out.replace(/__CHROME_LOGO_SRC__/g, logoSrc);

      const i18nScript = `<script>window.__CHROME_I18N__ = ${JSON.stringify(i18nObj)};</script>`;
      const styleTag = css ? `<style>\n${css}\n</style>` : '';
      const scriptTag = js ? `<script>\n${js}\n</script>` : '';

      if (styleTag && out.includes('</head>')) {
        out = out.replace('</head>', `${styleTag}\n</head>`);
      }
      if (i18nScript && out.includes('</head>')) {
        out = out.replace('</head>', `${i18nScript}\n</head>`);
      }
      if (scriptTag && out.includes('</body>')) {
        out = out.replace('</body>', `${scriptTag}\n</body>`);
      }

      return out;
    },
  };
}
