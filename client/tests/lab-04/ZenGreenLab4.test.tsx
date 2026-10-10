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
import { MetricCard } from "../../src/components/MetricCard.js";
import { MemoryRouter } from "react-router-dom";

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

// ---------------------------------------------------------------------------
// Lab 4, Issue 7 — STYLE-02 (docs/lab-04/tests.md §2.9; AC-29, ui-spec §1.1, §3.1, §3.6)
// ---------------------------------------------------------------------------

/** The text inside the `@media` block with this exact query, braces balanced. */
function mediaBlock(query: string, source: string): string {
  const start = source.indexOf(`@media ${query} {`);
  if (start === -1) throw new Error(`No @media ${query} in the section`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(source.indexOf("{", start) + 1, i);
  }
  throw new Error(`Unbalanced @media ${query}`);
}

describe("STYLE-02 the metric card (AC-29, ui-spec §1.1)", () => {
  const metric = () => sectionOf("Metric card and Requester Dashboard");

  it("is one link holding the label, the value, and View all, so the whole card is the target", () => {
    const { container } = render(
      <MemoryRouter>
        <MetricCard label="Open Tickets" value={3} to="/tickets?group=open" />
      </MemoryRouter>,
    );
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/tickets?group=open");
    expect(within(links[0] as HTMLElement).getByText("Open Tickets")).toBeInTheDocument();
    expect(within(links[0] as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(links[0]).toHaveTextContent(/View all/);
    expect(screen.getByRole("link", { name: "Open Tickets: 3. View all" })).toBe(links[0]);
  });

  it("is a plain block, with no link and no View all, when it has nowhere to go (BR-40)", () => {
    const { container } = render(<MetricCard label="Active Administrators" value={2} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.firstElementChild?.tagName).toBe("DIV");
    expect(container).not.toHaveTextContent(/View all/);
    expect(container).toHaveTextContent("Active Administrators");
    expect(container).toHaveTextContent("2");
  });

  it("draws 0 as 0 and keeps the link (BR-39)", () => {
    render(
      <MemoryRouter>
        <MetricCard label="Resolved" value={0} to="/tickets?status=RESOLVED" />
      </MemoryRouter>,
    );
    const card = screen.getByRole("link", { name: "Resolved: 0. View all" });
    expect(within(card).getByText("0")).toBeInTheDocument();
  });

  it("draws the label at 12 px, uppercase, in the muted colour", () => {
    const label = rule(".tt-metric__label", metric());
    expect(rule(".tt-metric", metric())).toMatch(/--tt-font-caption:\s*12px/);
    expect(label).toMatch(/font-size:\s*var\(--tt-font-caption\)/);
    expect(label).toMatch(/text-transform:\s*uppercase/);
    expect(label).toMatch(/(?<![-\w])color:\s*var\(--tt-text-muted\)/);
  });

  it("draws the value at 32 px in the brand green", () => {
    const value = rule(".tt-metric__value", metric());
    expect(rule(".tt-metric", metric())).toMatch(/--tt-font-metric:\s*32px/);
    expect(value).toMatch(/font-size:\s*var\(--tt-font-metric\)/);
    expect(value).toMatch(/(?<![-\w])color:\s*var\(--tt-green-primary\)/);
  });

  it("draws View all at 14 px, the label size, in the brand green", () => {
    const link = rule(".tt-metric__link", metric());
    expect(link).toMatch(/font-size:\s*var\(--tt-font-label\)/);
    expect(link).toMatch(/(?<![-\w])color:\s*var\(--tt-green-primary\)/);
  });

  it("is built from Lab 2's card: its surface, border, radius, and shadow", () => {
    const card = rule(".tt-metric", metric());
    expect(card).toMatch(/background:\s*var\(--tt-surface\)/);
    expect(card).toMatch(/border:\s*1px solid var\(--tt-border\)/);
    expect(card).toMatch(/border-radius:\s*var\(--tt-radius\)/);
    expect(card).toMatch(/box-shadow:\s*var\(--tt-shadow-card\)/);
  });

  it("shows the focus outline of Lab 2's links on the card, and has a hover and an active state", () => {
    expect(rule(".tt-metric--link:focus-visible", metric())).toMatch(/outline:\s*2px solid var\(--tt-green-secondary\)/);
    expect(rule(".tt-metric--link:focus-visible", metric())).toMatch(/outline-offset:\s*2px/);
    expect(rule(".tt-metric--link:hover", metric())).toMatch(/border-color:\s*var\(--tt-green-primary\)/);
    expect(rule(".tt-metric--link:active", metric())).toMatch(/background:\s*var\(--tt-green-pale\)/);
  });

  it("takes no underline from the browser's link style, so the number is not struck through", () => {
    expect(rule(".tt-metric", metric())).toMatch(/text-decoration:\s*none/);
  });

  it("adds no hard-coded colour: every colour in the section is a token", () => {
    const section = sectionOf("Metric card and Requester Dashboard");
    expect(section).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(section).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    for (const match of section.matchAll(/(?<![-\w])(?:color|background|border-color):\s*([^;]+);/g)) {
      expect(match[1], match[0]).toMatch(/^(var\(--tt-|transparent|inherit|none)/);
    }
  });
});

describe("STYLE-02 the Requester Dashboard's layout (AC-29, ui-spec §3.6)", () => {
  const section = () => sectionOf("Metric card and Requester Dashboard");

  it("puts four cards in one row from 992 px, as an even grid that cannot be pushed wider by its content", () => {
    expect(rule(".tt-dash__cards", section())).toMatch(/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  });

  it("puts the cards two by two from 768 to 991 px, and one per row below 768 px", () => {
    expect(rule(".tt-dash__cards", mediaBlock("(max-width: 991px)", section()))).toMatch(/repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(rule(".tt-dash__cards", mediaBlock("(max-width: 767px)", section()))).toMatch(/grid-template-columns:\s*1fr/);
  });

  it("keeps a row's Summary to one line with an ellipsis, so a long one cannot widen the page", () => {
    const summary = rule(".tt-dash-row__summary", section());
    expect(summary).toMatch(/white-space:\s*nowrap/);
    expect(summary).toMatch(/overflow:\s*hidden/);
    expect(summary).toMatch(/text-overflow:\s*ellipsis/);
    // The cell that holds it may shrink below its text.
    expect(rule(".tt-dash-row", section())).toMatch(/minmax\(0,\s*1fr\)/);
  });

  it("draws the Ticket Number in monospace, in the brand green, on one line", () => {
    const number = rule(".tt-dash-row__number", section());
    expect(number).toMatch(/font-family:[^;]*monospace/);
    expect(number).toMatch(/(?<![-\w])color:\s*var\(--tt-green-primary\)/);
    expect(number).toMatch(/white-space:\s*nowrap/);
  });

  it("shows the same focus outline on a row and on View all as on every other link", () => {
    expect(section()).toMatch(/\.tt-dash-row:focus-visible[^{]*\{[^}]*outline:\s*2px solid var\(--tt-green-secondary\)/);
    expect(section()).toMatch(/\.tt-dash__view-all:focus-visible[^{]*\{[^}]*outline:\s*2px solid var\(--tt-green-secondary\)/);
  });

  it("moves Refresh below the greeting, and stacks the quick actions with the primary on top, below 768 px", () => {
    const small = mediaBlock("(max-width: 767px)", section());
    expect(rule(".tt-dash__head", small)).toMatch(/flex-direction:\s*column/);
    expect(rule(".tt-dash__buttons", small)).toMatch(/flex-direction:\s*column/);
    // column, not column-reverse: the primary action is first in the page and stays first.
    expect(rule(".tt-dash__buttons", small)).not.toMatch(/column-reverse/);
  });

  it("lets a row break onto lines on a phone: the Summary on its own line, the date below", () => {
    const small = mediaBlock("(max-width: 767px)", section());
    expect(rule(".tt-dash-row", small)).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
    expect(rule(".tt-dash-row__summary", small)).toMatch(/grid-column:\s*1\s*\/\s*-1/);
  });

  it("styles the Requester Dashboard's skeletons at the size of the cards and the lists, so nothing jumps", () => {
    expect(rule(".tt-skeleton--card", section())).toMatch(/height:\s*\d+px/);
    expect(rule(".tt-skeleton--list", section())).toMatch(/height:\s*\d+px/);
  });

  it("gives a link styled as a button no underline, so Create Ticket looks like Lab 2's button", () => {
    expect(rule("a.tt-btn", section())).toMatch(/text-decoration:\s*none/);
  });
});

describe("The filter chip of My Tickets (ui-spec §7; AC-29)", () => {
  const chip = () => sectionOf("Filter chip");

  it("names its cross for what it does, and keeps the drawn symbol out of the accessible name", async () => {
    const { MyTickets } = await import("../../src/screens/MyTickets.js");
    vi.spyOn(api, "fetchMyTickets").mockResolvedValue({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPrev: false, hasNext: false } });
    vi.spyOn(api, "fetchCategories").mockResolvedValue([]);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([]);
    const { container } = render(<MyTickets query="group=open" onQueryChange={() => undefined} />);
    const cross = await screen.findByRole("button", { name: "Remove the Open tickets filter" });
    expect(cross.textContent).toBe("✕");
    expect(cross.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelector(".tt-chip")).toHaveTextContent("Open tickets");
  });

  it("is drawn in the pale green with the brand green text and border, like Lab 2's green badge", () => {
    const body = rule(".tt-chip", chip());
    expect(body).toMatch(/background:\s*var\(--tt-green-pale\)/);
    expect(body).toMatch(/(?<![-\w])color:\s*var\(--tt-green-primary\)/);
    expect(body).toMatch(/border:\s*1px solid var\(--tt-green-secondary\)/);
    expect(body).toMatch(/border-radius:\s*999px/);
  });

  it("shows the same focus outline on its cross as on every other control", () => {
    expect(rule(".tt-chip__remove:focus-visible", chip())).toMatch(/outline:\s*2px solid var\(--tt-green-secondary\)/);
  });

  it("makes its cross a touch target of 44 px on a phone", () => {
    const small = mediaBlock("(max-width: 767px)", chip());
    expect(rule(".tt-chip__remove", small)).toMatch(/min-width:\s*44px/);
    expect(rule(".tt-chip__remove", small)).toMatch(/min-height:\s*44px/);
  });

  it("adds no hard-coded colour", () => {
    expect(chip()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(chip()).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });

  // Found by looking at the phone screenshot: Lab 2's `flex: 1 1 240px` on the search box is a
  // width in a row, and a 240 px tall box in the column the toolbar becomes on a phone.
  it("keeps the search box one control tall on a phone, where the toolbar is a column", () => {
    const search = rule('.tt-toolbar input[type="search"]', mediaBlock("(max-width: 767px)", chip()));
    expect(search).toMatch(/flex:\s*0 0 auto/);
  });
});

describe("The Requester Dashboard's empty list (ui-spec §3.1)", () => {
  it("leaves no gap under the message, so an empty card is as tight as one with a button", () => {
    expect(rule(".tt-dash__list > .tt-muted", sectionOf("Metric card and Requester Dashboard"))).toMatch(/margin:\s*0/);
  });
});
