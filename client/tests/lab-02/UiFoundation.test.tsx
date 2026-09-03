import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, IconButton } from "../../src/components/Button.js";
import { PriorityBadge, StatusBadge, AttachmentBadge } from "../../src/components/Badge.js";
import {
  LoadingState,
  EmptyState,
  NoResultsState,
  ErrorState,
  SuccessCallout,
} from "../../src/components/States.js";
import { ResponsiveList, FieldGrid } from "../../src/components/Layout.js";

// Issue 3 AC-2 — reusable components exist for forms, lists, badges, loading,
// empty, and error presentation.
// Issue 3 AC-4 — the list primitive carries the responsive behaviour.

describe("Button", () => {
  it("renders each variant with its Zen Green class", () => {
    const { rerender, container } = render(<Button variant="primary">Submit Ticket</Button>);
    expect(container.querySelector(".tt-btn--primary")).not.toBeNull();

    rerender(<Button variant="secondary">Cancel</Button>);
    expect(container.querySelector(".tt-btn--secondary")).not.toBeNull();

    rerender(<Button variant="tertiary">Clear Filters</Button>);
    expect(container.querySelector(".tt-btn--tertiary")).not.toBeNull();

    rerender(<Button variant="destructive">Remove</Button>);
    expect(container.querySelector(".tt-btn--destructive")).not.toBeNull();
  });

  it("always shows visible text", () => {
    render(<Button variant="primary">Submit Ticket</Button>);
    expect(screen.getByRole("button", { name: "Submit Ticket" })).toHaveTextContent(
      "Submit Ticket",
    );
  });

  it("shows a busy state, swaps the label, and disables itself", () => {
    const { container } = render(
      <Button variant="primary" busy busyLabel="Submitting…">
        Submit Ticket
      </Button>,
    );
    const button = screen.getByRole("button");

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.className).toContain("tt-btn--busy");
    expect(button).toHaveTextContent("Submitting…");
    expect(container.querySelector(".tt-spinner")).not.toBeNull();
  });

  it("cannot be activated while busy", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" busy onClick={onClick}>
        Submit Ticket
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("cannot be activated while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Submit Ticket
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("requires an accessible label and tooltip on an icon-only control", () => {
    render(<IconButton label="Download attachment" icon="↓" />);
    const button = screen.getByRole("button", { name: "Download attachment" });

    expect(button).toHaveAttribute("aria-label", "Download attachment");
    expect(button).toHaveAttribute("title", "Download attachment");
  });
});

describe("Badges", () => {
  it("spells out priority as text, so colour is never the only signal", () => {
    const { rerender } = render(<PriorityBadge value="URGENT" />);
    expect(screen.getByText("URGENT")).toBeInTheDocument();

    rerender(<PriorityBadge value="LOW" />);
    expect(screen.getByText("LOW")).toBeInTheDocument();
  });

  it("spells out status as text", () => {
    render(<StatusBadge value="NEW" />);
    expect(screen.getByText("NEW")).toBeInTheDocument();
  });

  it("labels an attachment as Active or Removed in words", () => {
    const { rerender } = render(<AttachmentBadge removed={false} />);
    expect(screen.getByText("Active")).toBeInTheDocument();

    rerender(<AttachmentBadge removed />);
    expect(screen.getByText("Removed")).toBeInTheDocument();
  });

  it("uses one shared class set for every badge kind", () => {
    const { container } = render(
      <>
        <PriorityBadge value="HIGH" />
        <StatusBadge value="NEW" />
        <AttachmentBadge removed />
      </>,
    );

    const badges = Array.from(container.querySelectorAll(".tt-badge"));
    expect(badges).toHaveLength(3);
    // Identical base class everywhere is what keeps list, cards, and detail
    // looking the same.
    badges.forEach((badge) => expect(badge.className).toMatch(/^tt-badge tt-badge--/));
  });
});

describe("Shared states", () => {
  it("renders a loading state with skeletons and a polite announcement", () => {
    const { container } = render(<LoadingState rows={3} />);
    expect(container.querySelectorAll(".tt-skeleton")).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("renders an empty state with its own copy and next action", () => {
    render(
      <EmptyState
        title="You have no tickets yet."
        body="Create your first ticket to get started."
        action={<Button variant="primary">Create Ticket</Button>}
      />,
    );

    expect(screen.getByText("You have no tickets yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Ticket" })).toBeInTheDocument();
  });

  it("renders a no-results state that is distinct from empty", () => {
    const onClear = vi.fn();
    const { container } = render(<NoResultsState onClearFilters={onClear} />);

    expect(container.querySelector('[data-state="no-results"]')).not.toBeNull();
    expect(container.querySelector('[data-state="empty"]')).toBeNull();
    expect(screen.getByText(/No results match your filters/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear Filters" })).toBeInTheDocument();
  });

  it("distinguishes empty from no-results by marker and copy", () => {
    const empty = render(<EmptyState title="You have no tickets yet." />);
    const emptyText = empty.container.textContent;
    empty.unmount();

    const none = render(<NoResultsState />);
    expect(none.container.textContent).not.toBe(emptyText);
  });

  it("renders an error callout with a retry action", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Cannot reach the TokTickIT API." onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Cannot reach the TokTickIT API.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders a success callout with text, not colour alone", () => {
    render(<SuccessCallout>Ticket TT-2026-00042 created.</SuccessCallout>);
    expect(screen.getByRole("status")).toHaveTextContent("Ticket TT-2026-00042 created.");
  });
});

describe("Responsive list primitive", () => {
  const items = [
    { id: 1, number: "TT-2026-00041", summary: "VPN drops" },
    { id: 2, number: "TT-2026-00042", summary: "Battery drains" },
  ];

  function List() {
    return (
      <ResponsiveList
        items={items}
        columns={["Ticket Number", "Summary"]}
        keyOf={(item) => item.id}
        renderRow={(item) => (
          <>
            <td>{item.number}</td>
            <td>{item.summary}</td>
          </>
        )}
        renderCard={(item) => (
          <>
            <p>{item.number}</p>
            <p>{item.summary}</p>
          </>
        )}
      />
    );
  }

  it("renders a table for desktop and cards for mobile from one data set", () => {
    const { container } = render(<List />);

    expect(container.querySelector("table.tt-table")).not.toBeNull();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);

    expect(container.querySelector(".tt-cards")).not.toBeNull();
    expect(container.querySelectorAll(".tt-card-row")).toHaveLength(2);
  });

  it("labels table columns as headers for assistive technology", () => {
    render(<List />);
    expect(screen.getByRole("columnheader", { name: "Ticket Number" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Summary" })).toBeInTheDocument();
  });

  it("exposes desktop column counts that CSS collapses at smaller sizes", () => {
    const { container } = render(
      <FieldGrid columns={3}>
        <div />
      </FieldGrid>,
    );
    expect(container.querySelector(".tt-grid--3")).not.toBeNull();
  });
});
