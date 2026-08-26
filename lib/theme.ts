/**
 * The theme is `<html data-theme>`, and that attribute is the only state: the
 * palette in `app/globals.css` keys off it, and so does which glyph the toggle
 * shows. Two things write it — the script below, before first paint, and
 * `components/ThemeToggle.tsx` on click — which is why the cookie details live
 * here instead of being spelled out in both.
 *
 * A cookie rather than `localStorage` because storage is per-origin and this site
 * is deliberately several origins (see `cookieDomain` in `lib/networks.ts`).
 * Nothing reads it on the server, so it has no effect on caching or rendering.
 */
export type Theme = "dark" | "light";

export const COOKIE_NAME = "rialoscan-theme";

/** A year. Long enough that the choice reads as permanent. */
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Applies the theme before the browser paints. This has to be a blocking inline
 * script rather than an effect: React cannot know the theme on the server, so
 * anything that waits for hydration paints the default palette first and
 * corrects it a moment later, which is the flash of wrong colour that themed
 * sites are known for.
 *
 * A saved choice wins over the OS preference, since choosing one on this site is
 * a statement about this site. If the cookie is absent or damaged it falls back
 * to the OS, and if anything throws at all, to dark — which is what every
 * visitor got before this existed.
 */
export const THEME_SCRIPT = [
  "try{",
  `var m=document.cookie.match(/(?:^|; )${COOKIE_NAME}=(light|dark)/);`,
  'var t=m?m[1]:matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";',
  "document.documentElement.dataset.theme=t",
  '}catch(e){document.documentElement.dataset.theme="dark"}',
].join("");

/**
 * `SameSite=Lax` because nothing cross-site needs to read this, and `Secure`
 * only when the page is already HTTPS — a `Secure` cookie is silently dropped
 * over plain HTTP, which would break the toggle in local development.
 */
export function themeCookie(theme: Theme, opts: { domain: string | null; secure: boolean }): string {
  const parts = [`${COOKIE_NAME}=${theme}`, "path=/", `max-age=${MAX_AGE}`, "samesite=lax"];
  if (opts.domain) parts.push(`domain=.${opts.domain}`);
  if (opts.secure) parts.push("secure");
  return parts.join("; ");
}
