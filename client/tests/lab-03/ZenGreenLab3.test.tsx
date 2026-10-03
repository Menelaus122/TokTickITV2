import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// Read as raw text, like Lab 2's ZenGreenTheme.test.tsx: jsdom applies no real
// CSS, so what the stylesheet declares is asserted from its source.
import css from "../../src/styles/zen-green.css?raw";
import {
  OwnerPresentation,
  PriorityBadge,
  ROLE_LABEL,
  ReadOnlyField,
  RoleBadge,
  STATUS_LABEL,
  SelectInput,
  StatusBadge,
  TICKET_STATUSES,
  TextInput,
  UserStatusBadge,
} from "../../src/components/index.js";
import { Login } from "../../src/screens/Login.js";
import { ConversationThread, INTERNAL_CAPTION } from "../../src/components/ConversationThread.js";

// Lab 3 UI style — docs/lab-03/tests.md §2.11. Issue 9 added STYLE-03 and
// STYLE-07; Issue 11 completes STYLE-01, 02, 04, 05, and 06.

// The Lab 3 screens' source, read raw so STYLE-01 can check what they contain.
const SOURCES = import.meta.glob(
  [
    "../../src/screens/{Login,ChangePassword,StaffTicketQueue,StaffTicketDetail,UserManagement}.tsx",
    "../../src/components/{AppShell,ConversationThread,AppearsResolvedPanel,Badge}.tsx",
  ],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

/**
 * The stylesheet Lab 3 added: the conversation threads section, and every
 * section from "Lab 3: Login" to the end. Lab 2's sections are checked by
 * Lab 2's ZenGreenTheme.test.tsx.
 */
function lab3Css(): string {
  const threads = css.slice(css.indexOf("/* --- Conversation threads (Lab 3"), css.indexOf("/* --- States (ui-spec.md 6)"));
  return threads + css.slice(css.indexOf("/* --- Lab 3: Login"));
}

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

describe("STYLE-01 Lab 3 uses only the Lab 2 tokens (AC-37)", () => {
  it("found the Lab 3 sections and the Lab 3 screens to check", () => {
    expect(lab3Css().length).toBeGreaterThan(2000);
    expect(Object.keys(SOURCES)).toHaveLength(9);
  });

  it("introduces no new colour: every colour is a token, white, or a translucent tint of the text colour or white", () => {
    const declarations = lab3Css().replace(/\/\*[\s\S]*?\*\//g, "");
    const colours = declarations.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) ?? [];
    for (const colour of colours) {
      expect(colour, colour).toMatch(/^#fff$|^rgba\(28, 43, 36, \.\d+\)$|^rgba\(255, 255, 255, \.\d+\)$/i);
    }
    // --tt-text is #1C2B24, which is rgb(28, 43, 36): the tints are of a token.
    expect(css).toMatch(/--tt-text:\s*#1C2B24;/i);
  });

  it("introduces no new font size: every size is a --tt-font token", () => {
    const sizes = lab3Css().replace(/\/\*[\s\S]*?\*\//g, "").match(/font-size:\s*[^;]+;/g) ?? [];
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size, size).toMatch(/font-size:\s*var\(--tt-font-[a-z0-9]+\);/);
  });

  it("puts no colour in the screens' markup: no hex literal and no inline style", () => {
    for (const [file, source] of Object.entries(SOURCES)) {
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/);
      expect(source, file).not.toMatch(/style=\{\{/);
    }
  });
});

describe("STYLE-02 badges carry text, not colour alone (AC-39)", () => {
  it("spells out every status, priority, role, account status, and an unassigned owner", () => {
    render(
      <div>
        {TICKET_STATUSES.map((value) => <StatusBadge key={value} value={value} />)}
        {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((value) => <PriorityBadge key={value} value={value} />)}
        {(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const).map((value) => <RoleBadge key={value} value={value} />)}
        <UserStatusBadge active />
        <UserStatusBadge active={false} />
        <OwnerPresentation owner={null} />
        <OwnerPresentation owner={{ id: 4, fullName: "Prasert Chaiyo", isActive: false }} />
      </div>,
    );
    for (const status of TICKET_STATUSES) expect(screen.getByText(STATUS_LABEL[status])).toHaveClass("tt-badge");
    for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"]) expect(screen.getByText(priority)).toHaveClass("tt-badge");
    for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const) expect(screen.getByText(ROLE_LABEL[role])).toHaveClass("tt-badge");
    expect(screen.getByText("Active")).toHaveClass("tt-badge");
    expect(screen.getAllByText("Inactive")).toHaveLength(2);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    for (const badge of document.querySelectorAll(".tt-badge")) expect(badge.textContent?.trim()).not.toBe("");
  });
});

describe("STYLE-04 the red asterisk never replaces the message (AC-37)", () => {
  it("styles the asterisk with the error token", () => {
    expect(rule(".tt-field__required")).toMatch(/color:\s*var\(--tt-error\)/);
  });

  it("shows both the asterisk and the message on an invalid required field", () => {
    render(<TextInput label="Full name" required error="Enter the user's full name." value="" onChange={() => {}} />);
    const control = screen.getByLabelText(/Full name/);
    expect(control).toBeRequired();
    expect(control.closest(".tt-field")!.querySelector(".tt-field__required")).toHaveTextContent("*");
    expect(screen.getByText("Enter the user's full name.")).toBeInTheDocument();
  });
});

describe("STYLE-05 a validation message sits beneath its own field (AC-37)", () => {
  it("on a real screen, each message follows its own control and is announced by it", async () => {
    const user = userEvent.setup();
    render(<Login onSignIn={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    for (const [label, message] of [
      [/^Email/, "Enter your email address."],
      [/^Password/, "Enter your password."],
    ] as const) {
      const control = screen.getByLabelText(label);
      const text = screen.getByText(message);
      expect(control.closest(".tt-field")).toBe(text.closest(".tt-field"));
      // After the control in document order, never above it.
      expect(control.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(control).toHaveAttribute("aria-describedby", text.id);
      expect(control).toHaveAttribute("aria-invalid", "true");
    }
  });

  it("styles the message as a block in the error colour", () => {
    const message = rule(".tt-field__message");
    expect(message).toMatch(/display:\s*block/);
    expect(message).toMatch(/color:\s*var\(--tt-error\)/);
  });
});

describe("STYLE-06 a busy button is disabled, labelled, and sends one request (AC-38)", () => {
  it("on a real screen, a double submit sends one sign-in", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onSignIn = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<Login onSignIn={onSignIn} />);
    await user.type(screen.getByLabelText(/^Email/), "pornchai@toktickit.local");
    await user.type(screen.getByLabelText(/^Password/), "Toktickit#2026");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const busy = screen.getByRole("button", { name: "Signing in…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    await user.click(busy);
    await user.keyboard("{Enter}");
    expect(onSignIn).toHaveBeenCalledTimes(1);
    finish();
  });

  it("styles the busy and disabled states distinctly from an idle button", () => {
    expect(css).toMatch(/\.tt-btn--busy/);
    expect(css).toMatch(/\.tt-btn:disabled/);
  });
});
