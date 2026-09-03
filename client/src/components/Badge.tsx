// Badges for Requested Priority, Current Status, and Attachment state
// (ui-spec.md 5).
//
// Every badge renders its value as text. Colour is a second signal, never the
// only one, so the badge still reads correctly in greyscale or to a colour-blind
// user. All three badge kinds share the same class names, which is what keeps
// them identical across the list, the cards, and the detail screen.

type Tone = "neutral" | "green" | "amber" | "red";

function BadgeBase({ tone, text, kind }: { tone: Tone; text: string; kind: string }) {
  return (
    <span className={`tt-badge tt-badge--${tone}`} data-badge={kind}>
      {text}
    </span>
  );
}

// --- Requested Priority ----------------------------------------------------

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const PRIORITY_TONE: Record<Priority, Tone> = {
  LOW: "neutral",
  MEDIUM: "green",
  HIGH: "amber",
  URGENT: "red",
};

export function PriorityBadge({ value }: { value: Priority }) {
  return <BadgeBase kind="priority" tone={PRIORITY_TONE[value]} text={value} />;
}

// --- Current Status --------------------------------------------------------

// NEW is the only status Lab 2 produces (BR-02). The map is keyed by the enum
// so a later lifecycle value is a one-line addition, not a rewrite.
export type TicketStatus = "NEW";

const STATUS_TONE: Record<TicketStatus, Tone> = {
  NEW: "green",
};

export function StatusBadge({ value }: { value: TicketStatus }) {
  return <BadgeBase kind="status" tone={STATUS_TONE[value]} text={value} />;
}

// --- Attachment state ------------------------------------------------------

export function AttachmentBadge({ removed }: { removed: boolean }) {
  return (
    <BadgeBase
      kind="attachment"
      tone={removed ? "neutral" : "green"}
      text={removed ? "Removed" : "Active"}
    />
  );
}
