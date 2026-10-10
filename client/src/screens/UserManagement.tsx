import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AdminUser,
  ApiError,
  PASSWORD_MAX,
  PASSWORD_MIN,
  Role,
  UserChange,
  createUser,
  fetchUsers,
  issueInitialPassword,
  updateUser,
} from "../api.js";
import { useModal } from "../components/useModal.js";
import {
  Button,
  Card,
  EmptyState,
  ErrorCallout,
  ErrorState,
  ForbiddenState,
  LoadingState,
  NoResultsState,
  ROLE_LABEL,
  ReadOnlyField,
  ResponsiveList,
  RoleBadge,
  SelectInput,
  SuccessCallout,
  TextInput,
  UserStatusBadge,
} from "../components/index.js";

// Lab 3, Issue 10 — Administrator User Management (ui-spec §8; FR-38 to
// FR-45).
//
// One screen: the list, and one panel that creates or edits. The API enforces
// every rule; the disabled controls on the Administrator's own account and the
// refusal callouts are feedback, not the boundary (FR-44). There is no delete
// control anywhere, because there is no delete (BR-50).

export const SEARCH_DEBOUNCE_MS = 300;
export const OWN_ACCOUNT_HELP = "You cannot change your own role or deactivate yourself.";
export const PASSWORD_HELP = "The user must change this at their next sign-in.";
export const NEW_PASSWORD_WARNING = "This signs the user out everywhere and requires a password change at their next sign-in.";

const ROLES: Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
const COLUMNS = ["Name", "Email", "Role", "Status", "Actions"];

type LoadState = "loading" | "ready" | "forbidden" | "error";
type Panel = { mode: "create" } | { mode: "edit"; user: AdminUser } | null;

interface Draft {
  fullName: string;
  email: string;
  role: Role | "";
  isActive: boolean;
  initialPassword: string;
}

const EMPTY_DRAFT: Draft = { fullName: "", email: "", role: "", isActive: true, initialPassword: "" };

function passwordProblem(password: string): string | undefined {
  const length = [...password].length;
  if (length === 0) return "Enter an initial password.";
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) return `The password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`;
  return undefined;
}

/** Fast local feedback in the server's own words; the server re-checks everything. */
function draftProblems(draft: Draft, creating: boolean): Record<string, string> {
  const problems: Record<string, string> = {};
  if (draft.fullName.trim() === "") problems.fullName = "Enter the user's full name.";
  if (draft.email.trim() === "") problems.email = "Enter an email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) problems.email = "Enter a valid email address.";
  if (draft.role === "") problems.role = "Choose one role: Requester, IT Staff, or Administrator.";
  if (creating) {
    const problem = passwordProblem(draft.initialPassword);
    if (problem) problems.initialPassword = problem;
  }
  return problems;
}

/** A refusal shown as its own callout rather than on a field (ui-spec §8.4). */
function refusalOf(error: unknown): string | null {
  if (error instanceof ApiError && (error.code === "LAST_ADMINISTRATOR" || error.code === "SELF_DEACTIVATION")) return error.message;
  return null;
}

export function UserManagement({ currentUserId }: { currentUserId: number }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [success, setSuccess] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Only the latest request may set what is shown (as on the queue).
  const latest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latest.current;
    setState("loading");
    try {
      const rows = await fetchUsers({ q: debounced || undefined, role: role || undefined });
      if (request !== latest.current) return;
      setUsers(rows);
      setState("ready");
    } catch (error) {
      if (request !== latest.current) return;
      setUsers([]);
      setState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
    }
  }, [debounced, role]);

  useEffect(() => {
    void load();
  }, [load]);

  function clearSearch() {
    setSearch("");
    setDebounced("");
    setRole("");
  }

  function saved(message: string) {
    setPanel(null);
    setSuccess(message);
    void load();
  }

  if (state === "forbidden") {
    return <ForbiddenState what="User Management" hint="Only an Administrator can open it." />;
  }

  const filtering = debounced !== "" || role !== "";

  return (
    <Card title="User Management">
      <div className="tt-users__head">
        <Button
          variant="primary"
          data-control="create-user"
          onClick={() => {
            setSuccess(null);
            setPanel({ mode: "create" });
          }}
        >
          + Create user
        </Button>
      </div>

      {success && <SuccessCallout>{success}</SuccessCallout>}

      <div className="tt-toolbar tt-users__filters">
        <div className="tt-users__search">
          <TextInput type="search" label="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <SelectInput
          label="Role"
          value={role}
          placeholder="Any"
          options={ROLES.map((value) => ({ value, label: ROLE_LABEL[value] }))}
          onChange={(event) => setRole(event.target.value as Role | "")}
        />
      </div>

      {state === "loading" && <LoadingState rows={5} label="Loading users…" />}
      {state === "error" && (
        <ErrorState message="Cannot load the users. Make sure the TokTickIT API is running, then try again." onRetry={() => void load()} />
      )}
      {state === "ready" && users.length === 0 &&
        (filtering ? (
          <NoResultsState
            title="No users match this search"
            body="Try another name, email, or role."
            action={<Button variant="tertiary" onClick={clearSearch}>Clear search</Button>}
          />
        ) : (
          <EmptyState title="No users yet." body="Create the first user with + Create user." />
        ))}
      {state === "ready" && users.length > 0 && (
        <ResponsiveList
          items={users}
          columns={COLUMNS}
          caption="Users"
          keyOf={(user) => user.id}
          renderRow={(user) => (
            <>
              <td>
                {user.fullName}
                {user.id === currentUserId && <span className="tt-badge tt-badge--green tt-users__you">You</span>}
              </td>
              <td className="tt-users__email">{user.email}</td>
              <td>
                <RoleBadge value={user.role} />
              </td>
              <td>
                <UserStatusBadge active={user.isActive} />
              </td>
              <td>
                <Button variant="tertiary" aria-label={`Edit ${user.fullName}`} onClick={() => { setSuccess(null); setPanel({ mode: "edit", user }); }}>
                  Edit
                </Button>
              </td>
            </>
          )}
          renderCard={(user) => (
            <div className="tt-users__card" data-testid={`user-card-${user.id}`}>
              <strong>
                {user.fullName}
                {user.id === currentUserId && <span className="tt-badge tt-badge--green tt-users__you">You</span>}
              </strong>
              <span className="tt-users__email">{user.email}</span>
              <span className="tt-users__pills">
                <RoleBadge value={user.role} /> <UserStatusBadge active={user.isActive} />
              </span>
              <Button variant="secondary" aria-label={`Edit ${user.fullName}`} onClick={() => { setSuccess(null); setPanel({ mode: "edit", user }); }}>
                Edit
              </Button>
            </div>
          )}
        />
      )}

      {panel && (
        <UserPanel
          key={panel.mode === "edit" ? `edit-${panel.user.id}` : "create"}
          panel={panel}
          currentUserId={currentUserId}
          onClose={() => setPanel(null)}
          onSaved={saved}
        />
      )}
    </Card>
  );
}

interface UserPanelProps {
  panel: Exclude<Panel, null>;
  currentUserId: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function UserPanel({ panel, currentUserId, onClose, onSaved }: UserPanelProps) {
  const creating = panel.mode === "create";
  const editing = panel.mode === "edit" ? panel.user : null;
  const ownAccount = editing?.id === currentUserId;
  const titleId = useId();
  const roleName = useId();

  const [draft, setDraft] = useState<Draft>(
    editing ? { fullName: editing.fullName, email: editing.email, role: editing.role, isActive: editing.isActive, initialPassword: "" } : EMPTY_DRAFT,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issuing, setIssuing] = useState(false);

  // Focus goes in, Tab stays inside, Escape closes it unless a request is in flight, and focus goes back to
  // the control that opened it, or to + Create user when that row has been replaced by a reload (AC-30).
  const panelRef = useRef<HTMLDivElement>(null);
  useModal(panelRef, { onEscape: () => !busy && onClose(), restoreFocusTo: () => document.querySelector<HTMLElement>('[data-control="create-user"]') });

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const { [key]: _cleared, ...rest } = current;
      return rest;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const problems = draftProblems(draft, creating);
    setRefusal(null);
    setFailure(null);
    if (Object.keys(problems).length > 0) return setErrors(problems);

    setBusy(true);
    try {
      if (creating) {
        const user = await createUser({
          fullName: draft.fullName.trim(),
          email: draft.email.trim(),
          role: draft.role as Role,
          isActive: draft.isActive,
          initialPassword: draft.initialPassword,
        });
        onSaved(`Created ${user.fullName}. They must change the initial password at their next sign-in.`);
      } else {
        // Only what changed is sent, so the Administrator's own row never
        // sends a role or activation it cannot change.
        const change: UserChange = {};
        if (draft.fullName.trim() !== editing!.fullName) change.fullName = draft.fullName.trim();
        if (draft.email.trim().toLowerCase() !== editing!.email) change.email = draft.email.trim();
        if (draft.role !== editing!.role) change.role = draft.role as Role;
        if (draft.isActive !== editing!.isActive) change.isActive = draft.isActive;
        const user = await updateUser(editing!.id, change);
        onSaved(`Saved ${user.fullName}.${change.isActive === false ? " They were signed out everywhere." : ""}`);
      }
    } catch (error) {
      const refused = refusalOf(error);
      if (refused) setRefusal(refused);
      else if (error instanceof ApiError && Object.keys(error.fields).length > 0) setErrors(error.fields);
      else setFailure(error instanceof ApiError && error.status < 500 ? error.message : "That did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tt-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
      <form className="tt-drawer__panel tt-card" onSubmit={submit} noValidate>
        <h2 className="tt-h2" id={titleId}>{creating ? "Create user" : "Edit user"}</h2>

        {refusal && <ErrorCallout state="refused">{refusal}</ErrorCallout>}
        {failure && <ErrorCallout>{failure}</ErrorCallout>}

        <TextInput label="Full name" required value={draft.fullName} error={errors.fullName} disabled={busy} onChange={(event) => set("fullName", event.target.value)} />
        <TextInput label="Email" type="email" required value={draft.email} error={errors.email} disabled={busy} onChange={(event) => set("email", event.target.value)} />

        {/* Radio buttons, so "exactly one role" is in the control itself (BR-17). */}
        <fieldset className="tt-fieldset tt-users__roles" aria-describedby={errors.role ? `${roleName}-error` : ownAccount ? `${roleName}-help` : undefined}>
          <legend className="tt-field__label">
            Role<span className="tt-field__required" aria-hidden="true">*</span>
          </legend>
          {ROLES.map((value) => (
            <label key={value} className="tt-users__radio">
              <input
                type="radio"
                name={roleName}
                value={value}
                checked={draft.role === value}
                disabled={busy || ownAccount}
                required
                onChange={() => set("role", value)}
              />{" "}
              {ROLE_LABEL[value]}
            </label>
          ))}
          {errors.role && (
            <p className="tt-field__message" id={`${roleName}-error`} role="alert">
              {errors.role}
            </p>
          )}
        </fieldset>

        <div className="tt-field">
          <label className="tt-users__toggle">
            <input
              type="checkbox"
              role="switch"
              checked={draft.isActive}
              aria-describedby={ownAccount ? `${roleName}-help` : undefined}
              disabled={busy || ownAccount}
              onChange={(event) => set("isActive", event.target.checked)}
            />{" "}
            Active
          </label>
          {errors.isActive && <p className="tt-field__message">{errors.isActive}</p>}
        </div>
        {ownAccount && (
          <p className="tt-field__help" id={`${roleName}-help`} data-state="own-account">
            {OWN_ACCOUNT_HELP}
          </p>
        )}

        {creating ? (
          <TextInput
            label="Initial password"
            type="password"
            autoComplete="new-password"
            required
            value={draft.initialPassword}
            error={errors.initialPassword}
            help={PASSWORD_HELP}
            disabled={busy}
            onChange={(event) => set("initialPassword", event.target.value)}
          />
        ) : (
          editing?.department && <ReadOnlyField label="Department" value={editing.department} help="Shown from Lab 2; not edited here." />
        )}

        <div className="tt-actions">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy} busyLabel={creating ? "Creating…" : "Saving…"}>
            {creating ? "Create user" : "Save changes"}
          </Button>
        </div>

        {editing && !ownAccount && (
          <div className="tt-users__password">
            {issuing ? (
              <InitialPasswordConfirm user={editing} onCancel={() => setIssuing(false)} onIssued={() => onSaved(`Set a new initial password for ${editing.fullName}. They were signed out everywhere.`)} />
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => setIssuing(true)}>
                Set new initial password
              </Button>
            )}
          </div>
        )}
        {ownAccount && <p className="tt-muted">Change your own password from Change Password, which asks for the current one.</p>}
      </form>
    </div>
  );
}

function InitialPasswordConfirm({ user, onCancel, onIssued }: { user: AdminUser; onCancel: () => void; onIssued: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    setBusy(true);
    setError(undefined);
    try {
      await issueInitialPassword(user.id, password);
      onIssued();
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.fields.initialPassword ?? failure.message : "The new initial password could not be set.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tt-users__confirm" role="group" aria-label="Set new initial password">
      <p>
        <strong>Set a new initial password for {user.fullName}?</strong> {NEW_PASSWORD_WARNING}
      </p>
      <TextInput
        label="New initial password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        error={error}
        help={`${PASSWORD_MIN}–${PASSWORD_MAX} characters.`}
        disabled={busy}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(undefined);
        }}
      />
      <div className="tt-actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" busy={busy} busyLabel="Setting…" onClick={() => void confirm()}>
          Set password and sign out
        </Button>
      </div>
    </div>
  );
}

export default UserManagement;
