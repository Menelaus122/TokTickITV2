// Badges for Requested Priority, Current Status, and Attachment state
// (ui-spec.md 5).
//
// Every badge renders its value as text. Colour is a second signal, never the
// only one, so the badge still reads correctly in greyscale or to a colour-blind
// user. All three badge kinds share the same class names, which is what keeps
// them identical across the list, the cards, and the detail screen.

type Tone = "neutral" | "green" | "amber" | "red" | "readonly" | "solid" | "outline" | "success";

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

// Lab 3 tickets move through eight statuses (ui-spec §1.3). They share one
// pill geometry; the tone groups statuses by what they ask of the Requester,
// and the label is title case with spaces, never the raw enum.
export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export const TICKET_STATUSES: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

const STATUS_TONE: Record<TicketStatus, Tone> = {
  NEW: "green",
  OPEN: "outline",
  IN_PROGRESS: "outline",
  WAITING_FOR_REQUESTER: "amber",
  RESOLVED: "success",
  CLOSED: "success",
  REOPENED: "red",
  CANCELLED: "neutral",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

export function StatusBadge({ value }: { value: TicketStatus }) {
  return <BadgeBase kind="status" tone={STATUS_TONE[value]} text={STATUS_LABEL[value]} />;
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

// --- Role (Lab 3, ui-spec §1.1) ---------------------------------------------

export type RoleValue = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

const ROLE_TONE: Record<RoleValue, Tone> = {
  REQUESTER: "readonly",
  IT_STAFF: "green",
  ADMINISTRATOR: "solid",
};

export const ROLE_LABEL: Record<RoleValue, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

// The role is always spelled out; the shade is never the only signal.
export function RoleBadge({ value }: { value: RoleValue }) {
  return <BadgeBase kind="role" tone={ROLE_TONE[value]} text={ROLE_LABEL[value]} />;
}

// --- Account status (Lab 3, Issue 10; ui-spec §8.1) -------------------------

// "Active" or "Inactive" in words with a pill, never a bare colour dot.
export function UserStatusBadge({ active }: { active: boolean }) {
  return <BadgeBase kind="user-status" tone={active ? "success" : "neutral"} text={active ? "Active" : "Inactive"} />;
}

// --- Owner (Lab 3, ui-spec §1.2) --------------------------------------------

export interface OwnerValue {
  id: number;
  fullName: string;
  /** Lab 4 (BR-55): beside isActive, what tells "Inactive" from "No longer IT Staff". */
  role: RoleValue;
  isActive: boolean;
}

/**
 * What is wrong with an owner, if anything (Lab 4 BR-55, ui-spec §1.6): `inactive` when the account is
 * deactivated, which is the stronger fact and so wins, and `not-staff` when it is active but its role
 * was changed to Requester after the ticket was assigned. An owner who is still assignable has neither.
 */
export function ownerProblem(owner: Pick<OwnerValue, "role" | "isActive">): "inactive" | "not-staff" | null {
  if (!owner.isActive) return "inactive";
  return owner.role === "REQUESTER" ? "not-staff" : null;
}

// Never an empty cell: an unassigned ticket says so in words (FR-28). A
// deactivated owner keeps their name, marked Inactive (BR-26), an active one who
// is no longer IT Staff is marked so (BR-55), and the signed-in IT Staff
// member's own tickets carry a "You" pill.
export function OwnerPresentation({ owner, currentUserId }: { owner: OwnerValue | null; currentUserId?: number }) {
  if (!owner) {
    return (
      <em className="tt-owner tt-owner--unassigned" data-owner="unassigned">
        Unassigned
      </em>
    );
  }
  return (
    <span className="tt-owner" data-owner={owner.id}>
      {owner.fullName}
      {ownerProblem(owner) === "inactive" && <BadgeBase kind="owner-inactive" tone="neutral" text="Inactive" />}
      {ownerProblem(owner) === "not-staff" && <BadgeBase kind="owner-not-staff" tone="neutral" text="No longer IT Staff" />}
      {owner.id === currentUserId && <BadgeBase kind="owner-you" tone="green" text="You" />}
    </span>
  );
}

// --- Follow-up (Lab 4, ui-spec §1.3) -----------------------------------------

// Lab 2's pill geometry with a text label, so the colour is never the signal.
export function FollowUpPill({ required }: { required: boolean }) {
  return required ? (
    <BadgeBase kind="follow-up" tone="amber" text="Follow-up needed" />
  ) : (
    <BadgeBase kind="follow-up" tone="neutral" text="No follow-up" />
  );
}
