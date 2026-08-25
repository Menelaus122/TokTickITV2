import { describe, it, expect } from "vitest";
// Imported through Vite as raw text: the assertions below are about the
// stylesheet's contents, and this keeps the test free of Node filesystem types.
import css from "../../src/styles/zen-green.css?raw";

// Issue 3 AC-1 — the Zen Green palette is configured as tokens.
// Issue 3 AC-4 — the three required breakpoints exist.
//
// These assertions read the stylesheet itself rather than a rendered component,
// because what is being verified is that the design system exists in one place
// with the exact values ui-spec.md 1 specifies. jsdom does not apply real CSS,
// so a rendered-colour assertion here would prove nothing.

describe("Zen Green theme tokens", () => {
  // Exactly the palette in docs/lab-02/ui-spec.md section 1.
  const REQUIRED_TOKENS: Record<string, string> = {
    "--tt-green-primary": "#006B3C",
    "--tt-green-secondary": "#0B7A46",
    "--tt-green-pale": "#EAF6EF",
    "--tt-bg-page": "#F5F7F6",
    "--tt-surface": "#FFFFFF",
    "--tt-border": "#D8E0DB",
    "--tt-text": "#1C2B24",
    "--tt-text-muted": "#5B6B63",
    "--tt-readonly-bg": "#EDF1EE",
    "--tt-error": "#A4161A",
    "--tt-error-bg": "#FBE9E9",
    "--tt-warning": "#B26A00",
    "--tt-warning-bg": "#FDF3E2",
    "--tt-success": "#1B7A4B",
    "--tt-success-bg": "#E8F5EE",
    "--tt-disabled-bg": "#EFF1F0",
    "--tt-disabled-text": "#9AA5A0",
  };

  it.each(Object.entries(REQUIRED_TOKENS))(
    "declares %s as %s",
    (token, value) => {
      expect(css).toMatch(new RegExp(`${token}\\s*:\\s*${value}\\s*;`, "i"));
    },
  );

  it("uses the mandated primary green for the primary button", () => {
    expect(css).toMatch(/\.tt-btn--primary\s*\{[^}]*background:\s*var\(--tt-green-primary\)/);
  });

  it("uses the mandated page background on the body", () => {
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--tt-bg-page\)/);
  });

  it("consumes tokens rather than repeating raw hex values in components", () => {
    // Every literal hex must live in the :root token block. Anything after it
    // means a component hard-coded a colour instead of using a token.
    const afterRoot = css.slice(css.indexOf("}", css.indexOf(":root")));
    const strays = (afterRoot.match(/#[0-9a-f]{6}\b/gi) ?? []).filter(
      (hex: string) => hex.toLowerCase() !== "#ffffff",
    );
    expect(strays).toEqual([]);
  });
});

describe("responsive breakpoints", () => {
  it("defines the desktop breakpoint at >= 992px", () => {
    expect(css).toMatch(/@media\s*\(min-width:\s*992px\)/);
  });

  it("defines the tablet band as 768-991px", () => {
    expect(css).toMatch(/@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*991px\)/);
  });

  it("defines the mobile breakpoint below 768px", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)/);
  });

  it("stacks the field grid to one column on mobile", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(mobile).toMatch(/grid-template-columns:\s*1fr/);
  });

  it("swaps the table for cards on mobile so the page never scrolls sideways", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(mobile).toMatch(/\.tt-table\s*\{\s*display:\s*none/);
    expect(mobile).toMatch(/\.tt-cards\s*\{\s*display:\s*block/);
    expect(css).toMatch(/html,\s*body\s*\{\s*overflow-x:\s*hidden/);
  });

  it("keeps buttons touch-friendly at mobile size", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(mobile).toMatch(/\.tt-btn\s*\{\s*min-height:\s*44px/);
  });
});
