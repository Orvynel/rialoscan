"use client";

import { cookieDomain } from "@/lib/networks";
import { themeCookie } from "@/lib/theme";
import { MoonIcon, SunIcon } from "./Icons";

/**
 * Writes the theme straight to the document, with no React state.
 *
 * State would have to start at some value during the server render, where the
 * theme is not knowable, so the first client render would either contradict the
 * markup or have to draw a placeholder until mounted. There is already a single
 * source of truth — `data-theme` on `<html>`, set before paint by the script in
 * `app/layout.tsx` — so this only has to flip it. Which glyph shows is decided
 * by CSS from the same attribute, so the button is right on the first paint
 * rather than after hydration.
 *
 * `host` comes from the server rather than `window.location`, for the same reason
 * `NetworkSwitcher` takes it: the markup has to be identical on both sides of
 * hydration.
 */
export function ThemeToggle({ host }: { host: string }) {
  return (
    <button
      type="button"
      className="theme-toggle"
      title="Switch between light and dark"
      aria-label="Switch between light and dark"
      onClick={() => {
        const root = document.documentElement;
        const next = root.dataset.theme === "light" ? "dark" : "light";
        root.dataset.theme = next;
        document.cookie = themeCookie(next, {
          domain: cookieDomain(host),
          secure: location.protocol === "https:",
        });
      }}
    >
      {/* Each glyph names the theme the click leads to, not the one in force. */}
      <span className="theme-sun">
        <SunIcon />
      </span>
      <span className="theme-moon">
        <MoonIcon />
      </span>
    </button>
  );
}
