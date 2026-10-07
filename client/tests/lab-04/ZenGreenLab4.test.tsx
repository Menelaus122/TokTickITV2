import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// Read as raw text, as Lab 2's and Lab 3's style tests do: what the stylesheet
// declares is asserted from its source.
import css from "../../src/styles/zen-green.css?raw";
import * as api from "../../src/api.js";
import { FollowUpPill } from "../../src/components/index.js";
import { ActionsTakenRegion } from "../../src/components/ActionsTakenRegion.js";
import { StatusHistoryRegion } from "../../src/components/StatusHistoryRegion.js";

// Lab 4 UI style — docs/lab-04/tests.md §2.9. Issue 5 adds STYLE-03: the
// follow-up pill and the Follow-up Note's asterisk (ui-spec §1.2, §1.3, §4.2;
// FR-26, FR-31). The other Lab 4 style tests arrive with the issues that add
// their screens.

afterEach(() => {
  vi.restoreAllMocks();
});

/** The stylesheet Issue 5 added: from its heading to the next section, or the end. */
function actionsTakenCss(): string {
  const start = css.indexOf("/* --- Lab 4: Actions Taken");
  if (start === -1) throw new Error("The Actions Taken section is missing from zen-green.css");
  const next = css.indexOf("/* --- Lab 4:", start + 10);
  return css.slice(start, next === -1 ? undefined : next);
}

/**
 * The declarations of the first rule in `source` whose selector list contains
 * `selector`. It must be that whole class: `.tt-action` is not `.tt-action-form`.
 */
function rule(selector: string, source: string = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|[},])\\s*[^{}]*${escaped}(?![\\w-])[^{}]*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`No rule for ${selector}`);
  return match[1];
}

describe("STYLE-03 the follow-up pill and the Follow-up Note's asterisk (AC-30, AC-04, FR-31)", () => {
  it("says it in words, so colour is never the signal: 'Follow-up needed' and 'No follow-up'", () => {
    const { container } = render(
      <>
        <FollowUpPill required />
        <FollowUpPill required={false} />
      </>,
    );
    const [yes, no] = Array.from(container.querySelectorAll("[data-badge='follow-up']"));
    expect(yes).toHaveTextContent("Follow-up needed");
    expect(no).toHaveTextContent("No follow-up");
    // The words differ, not only the shade.
    expect(yes.textContent).not.toBe(no.textContent);
  });

  it("draws Yes in the warning tokens and No in the muted ones, both Lab 2's pill geometry", () => {
    const { container } = render(
      <>
        <FollowUpPill required />
        <FollowUpPill required={false} />
      </>,
    );
    const [yes, no] = Array.from(container.querySelectorAll("[data-badge='follow-up']"));
    expect(yes).toHaveClass("tt-badge", "tt-badge--amber");
    expect(no).toHaveClass("tt-badge", "tt-badge--neutral");
    const amber = rule(".tt-badge--amber");
    expect(amber).toMatch(/background:\s*var\(--tt-warning-bg\)/);
    expect(amber).toMatch(/color:\s*var\(--tt-warning\)/);
    const neutral = rule(".tt-badge--neutral");
    expect(neutral).toMatch(/background:\s*var\(--tt-disabled-bg\)/);
    expect(neutral).toMatch(/color:\s*var\(--tt-text-muted\)/);
  });

  it("shows the red asterisk and the required attribute on Follow-up Note for Yes only", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([]);
    render(
      <ActionsTakenRegion
        ticketId={12}
        ticketStatus="IN_PROGRESS"
        ticketCreatedAt="2026-09-28T02:10:00.000Z"
        mode="staff"
        currentUser={{ fullName: "Nattapong Saelim", role: "IT_STAFF" }}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "+ Add action" }));
    const form = within(screen.getByRole("form", { name: "Record an action" }));

    // No: there is no note, so nothing about it is required or starred.
    expect(form.queryByLabelText(/^Follow-up Note/)).not.toBeInTheDocument();

    await user.click(form.getByRole("radio", { name: "Yes" }));
    const note = form.getByLabelText(/^Follow-up Note/);
    expect(note).toBeRequired();
    const star = note.closest(".tt-field")!.querySelector(".tt-field__required");
    expect(star).toHaveTextContent("*");
    // The star is the Lab 2 red, and is decoration: the requirement is spoken by `required`.
    expect(rule(".tt-field__required")).toMatch(/color:\s*var\(--tt-error\)/);
    expect(star).toHaveAttribute("aria-hidden", "true");

    // Optional Attachment Notes never carries one.
    expect(form.getByLabelText(/^Attachment Notes/).closest(".tt-field")!.querySelector(".tt-field__required")).toBeNull();
  });
});

describe("the Action Taken entry uses only Zen Green (FR-26, ui-spec §1.2, §4.5)", () => {
  it("adds no colour, no font size, and no spacing that is not a token", () => {
    const added = actionsTakenCss();
    expect(added).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(added).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    // Every font size and colour is a variable of the shared palette.
    for (const match of added.matchAll(/font-size:\s*([^;]+);/g)) expect(match[1], match[0]).toMatch(/^var\(--tt-font-/);
    for (const match of added.matchAll(/(?<![-\w])color:\s*([^;]+);/g)) expect(match[1], match[0]).toMatch(/^var\(--tt-/);
  });

  it("draws an entry as a bordered surface card", () => {
    const entry = rule(".tt-action", actionsTakenCss());
    expect(entry).toMatch(/background:\s*var\(--tt-surface\)/);
    expect(entry).toMatch(/border:\s*1px solid var\(--tt-border\)/);
  });

  it("keeps the 'Latest recorded' tag as text with its own outline, not a colour alone", () => {
    const tag = rule(".tt-action__latest", actionsTakenCss());
    expect(tag).toMatch(/border:\s*1px solid var\(--tt-green-primary\)/);
  });

  it("puts each label above its value, and beside it in a 180 px column from 992 px (ui-spec §4.5)", () => {
    const added = actionsTakenCss();
    expect(rule(".tt-action__fields", added)).toMatch(/grid-template-columns:\s*1fr\s*;/);
    const desktop = added.slice(added.indexOf("@media (min-width: 992px)"));
    expect(desktop).toMatch(/\.tt-action__fields\s*\{[^}]*grid-template-columns:\s*180px/);
  });

  it("wraps long text and never clips it or lets it widen the page", () => {
    const values = rule(".tt-action__fields dd", actionsTakenCss());
    expect(values).toMatch(/overflow-wrap:\s*anywhere/);
    expect(values).not.toMatch(/overflow:\s*hidden|text-overflow|white-space:\s*nowrap/);
    expect(rule(".tt-action", actionsTakenCss())).toMatch(/min-width:\s*0/);
  });

  it("shows a visible outline when a card heading takes focus after a save", () => {
    expect(rule(".tt-action__title:focus", actionsTakenCss())).toMatch(/outline:\s*2px solid var\(--tt-green-secondary\)/);
  });

  // Found by looking at the screens: three things the form got wrong that no assertion on behaviour could see.
  it("puts the Follow-Up Required? legend on the same left edge as every other label", () => {
    // Lab 2's fieldset gives its legend padding, which pushed this one in from the labels around it.
    expect(rule(".tt-action-form .tt-fieldset legend", actionsTakenCss())).toMatch(/padding:\s*0\s*;/);
  });

  it("leaves room above and below the radios, so they do not touch the label under them", () => {
    expect(rule(".tt-action-form .tt-fieldset", actionsTakenCss())).toMatch(/margin:\s*var\(--tt-space-4\) 0\s*;/);
  });

  it("keeps the Performed by badge beside the name, not at the far edge of the form", () => {
    // A field that grows to fill the row leaves the badge a form's width away from the name it belongs to.
    expect(rule(".tt-action-form__performer .tt-field", actionsTakenCss())).toMatch(/flex:\s*0 1 /);
  });

  it("does not reuse the name of an existing class: the region is not the button row", () => {
    // `.tt-actions` is Lab 2's row of buttons; the region and its entries have their own names.
    const used = [...actionsTakenCss().matchAll(/\.tt-actions-taken|\.tt-action(?![\w-]*s\b)/g)];
    expect(used.length).toBeGreaterThan(0);
    expect(actionsTakenCss()).not.toMatch(/\.tt-actions\s*\{/);
  });
});

// ---------------------------------------------------------------------------
// Lab 4, Issue 6 — STYLE-06 (docs/lab-04/tests.md §2.9; AC-29, ui-spec §1.2, §1.4)
// ---------------------------------------------------------------------------

/** One section of the Lab 4 stylesheet, from its heading to the next Lab 4 heading or the end. */
function sectionOf(heading: string): string {
  const start = css.indexOf(`/* --- Lab 4: ${heading}`);
  if (start === -1) throw new Error(`The "${heading}" section is missing from zen-green.css`);
  const next = css.indexOf("/* --- Lab 4:", start + 10);
  return css.slice(start, next === -1 ? undefined : next);
}

describe("STYLE-06 the Action Taken card and the timeline (AC-29, ui-spec §1.2, §1.4)", () => {
  it("draws the Action Taken card as a definition list, each value beside its own label", async () => {
    vi.spyOn(api, "fetchActionsTaken").mockResolvedValue([
      {
        id: 31, ticketId: 12, actionAt: "2026-10-05T03:10:00.000Z", description: "Replaced the toner cartridge.", result: "Printed cleanly.",
        performedBy: { id: 7, fullName: "Wirachat T.", role: "IT_STAFF" }, followUpRequired: true, followUpNote: "Check on Thursday.", attachmentNotes: null,
        version: 1, createdAt: "2026-10-05T03:12:41.000Z", updatedAt: "2026-10-05T03:12:41.000Z", updatedBy: null,
      },
    ]);
    const { container } = render(<ActionsTakenRegion ticketId={12} ticketStatus="IN_PROGRESS" ticketCreatedAt="2026-09-28T02:10:00.000Z" mode="requester" />);
    await screen.findByRole("heading", { level: 2, name: "Actions Taken (1)" });
    const definitions = container.querySelector("li.tt-action > dl.tt-action__fields")!;
    expect(definitions).not.toBeNull();
    // Every term is followed by exactly one value, so a screen reader reads each label with its value.
    const children = Array.from(definitions.children).map((child) => child.tagName);
    expect(children.length % 2).toBe(0);
    children.forEach((tag, index) => expect(tag).toBe(index % 2 === 0 ? "DT" : "DD"));
  });

  it("draws the timeline as an ordered list, so the order is announced, each step a list item with its time", async () => {
    vi.spyOn(api, "fetchStatusHistory").mockResolvedValue([
      { id: 1, fromStatus: "NEW", toStatus: "OPEN", changedBy: { id: 7, fullName: "Wirachat T.", role: "IT_STAFF" }, createdAt: "2026-10-04T08:20:00.000Z" },
      { id: 2, fromStatus: "OPEN", toStatus: "IN_PROGRESS", changedBy: { id: 7, fullName: "Wirachat T.", role: "IT_STAFF" }, createdAt: "2026-10-04T08:40:00.000Z" },
    ]);
    const { container } = render(<StatusHistoryRegion ticketId={12} ticketCreatedAt="2026-09-28T02:10:00.000Z" />);
    await screen.findByRole("list");
    const list = container.querySelector("ol.tt-timeline")!;
    expect(list).not.toBeNull();
    const steps = Array.from(list.querySelectorAll(":scope > li.tt-timeline__step"));
    expect(steps).toHaveLength(3);
    for (const step of steps) expect(step.querySelector("time")).not.toBeNull();
    // The newest step is last and nothing more: it carries no class that would mark it.
    expect(steps.at(-1)!.className).toBe("tt-timeline__step");
  });

  it("styles the timeline with a vertical rule in the border colour, and a marker in the brand green, and nothing else", () => {
    const timeline = sectionOf("Status History");
    expect(rule(".tt-timeline", timeline)).toMatch(/border-left:\s*2px solid var\(--tt-border\)/);
    expect(rule(".tt-timeline__step::before", timeline)).toMatch(/background:\s*var\(--tt-green-primary\)/);
  });

  it("does not highlight the newest step by colour: no rule singles out the last one", () => {
    const timeline = sectionOf("Status History");
    expect(timeline).not.toMatch(/:last-child|:last-of-type/);
  });

  it("adds no colour, font size, or spacing that is not a token, in the timeline and the blocked-moves list", () => {
    for (const added of [sectionOf("Status History"), sectionOf("Status control")]) {
      expect(added).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(added).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
      for (const match of added.matchAll(/font-size:\s*([^;]+);/g)) expect(match[1], match[0]).toMatch(/^var\(--tt-font-/);
      for (const match of added.matchAll(/(?<![-\w])color:\s*([^;]+);/g)) expect(match[1], match[0]).toMatch(/^var\(--tt-/);
    }
  });

  it("wraps a long name or reason instead of clipping it or widening the page", () => {
    const step = rule(".tt-timeline__step", sectionOf("Status History"));
    expect(step).toMatch(/flex-wrap:\s*wrap/);
    expect(step).toMatch(/overflow-wrap:\s*anywhere/);
    expect(step).not.toMatch(/overflow:\s*hidden|text-overflow|white-space:\s*nowrap/);
    expect(rule(".tt-staff-detail__blocked li", sectionOf("Status control"))).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
