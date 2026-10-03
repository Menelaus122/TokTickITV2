import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
// Read as raw text, like Lab 2's ZenGreenTheme.test.tsx: jsdom applies no real
// CSS, so what the stylesheet declares is asserted from its source.
import css from "../../src/styles/zen-green.css?raw";
import { ReadOnlyField, SelectInput } from "../../src/components/index.js";
import { ConversationThread, INTERNAL_CAPTION } from "../../src/components/ConversationThread.js";

// Lab 3 UI style — docs/lab-03/tests.md §2.11. Issue 9 adds STYLE-03 and
// STYLE-07; the other rows arrive with the issues that own them.

/** The declarations of the first rule whose selector list contains `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|[},])\\s*[^{}]*${escaped}[^{}]*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`No rule for ${selector}`);
  return match[1];
}

describe("STYLE-03 read-only is not disabled (AC-37)", () => {
  it("styles read-only fields with --tt-readonly-bg and readable text", () => {
    const readonly = rule(".tt-field__control[readonly]");
    expect(readonly).toMatch(/background:\s*var\(--tt-readonly-bg\)/);
    expect(readonly).toMatch(/color:\s*var\(--tt-text\)/);
  });

  it("styles disabled controls with their own tokens, not the read-only ones", () => {
    const disabled = rule(".tt-field__control:disabled");
    expect(disabled).toMatch(/var\(--tt-disabled-bg\)/);
    expect(disabled).not.toMatch(/--tt-readonly-bg/);
  });

  it("renders a read-only field as readonly and focusable, never disabled", () => {
    render(
      <>
        <ReadOnlyField label="Requested Priority" value="MEDIUM" />
        <SelectInput label="IT Priority" options={[{ value: "HIGH", label: "HIGH" }]} disabled />
      </>,
    );
    const readonly = screen.getByLabelText("Requested Priority");
    expect(readonly).toHaveAttribute("readonly");
    expect(readonly).not.toBeDisabled();
    expect(readonly).toHaveClass("tt-field__control--readonly");
    expect(screen.getByLabelText("IT Priority")).toBeDisabled();
  });
});

describe("STYLE-07 the Internal Notes region (AC-39)", () => {
  it("has a dashed left edge on the read-only background", () => {
    const internal = rule(".tt-thread--internal");
    expect(internal).toMatch(/border-left:\s*\d+px\s+dashed/);
    expect(internal).toMatch(/background:\s*var\(--tt-readonly-bg\)/);
  });

  it("carries the lock, the caption in words, and the caption in its accessible name", () => {
    render(<ConversationThread variant="internal" status="ready" entries={[]} onRetry={() => {}} onPost={async () => {}} />);
    const region = screen.getByRole("region", { name: `Internal Notes — ${INTERNAL_CAPTION}` });
    expect(region).toHaveClass("tt-thread--internal");
    expect(region).toHaveTextContent("🔒");
    expect(region).toHaveTextContent(INTERNAL_CAPTION);
  });
});
