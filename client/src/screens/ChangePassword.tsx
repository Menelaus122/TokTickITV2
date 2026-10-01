import { FormEvent, useEffect, useRef, useState } from "react";
import { ApiError, PasswordChange } from "../api.js";
import { Button, Card, SuccessCallout, TextInput, WarningCallout } from "../components/index.js";

// Lab 3, Issue 5 — the Change Password screen (ui-spec §4, FR-03, FR-04).
//
// Mandatory after signing in with an initial password, when it renders with no
// shell so there is nowhere to escape to (BR-02, BR-14); voluntary from the
// shell otherwise. The rules mirror BR-07 for fast feedback; the server decides.

export const PASSWORD_RULES = "8–72 characters. Must not be your email address.";

type Errors = Partial<Record<keyof PasswordChange, string>>;

// BR-07, including bcrypt's 72-byte limit: a Thai character is three bytes.
export function checkNewPassword(password: string, email: string): string | undefined {
  if (password === "") return "Enter a new password.";
  const chars = [...password].length;
  if (chars < 8) return "Password must be at least 8 characters.";
  if (chars > 72) return "Password must be at most 72 characters.";
  if (new TextEncoder().encode(password).length > 72) {
    return "Password is too long. Thai and other non-Latin characters count as more than one character.";
  }
  if (password.toLowerCase() === email.trim().toLowerCase()) return "Password must not be your email address.";
  return undefined;
}

export interface ChangePasswordProps {
  email: string;
  mandatory: boolean;
  onChange: (change: PasswordChange) => Promise<void>;
  /** Where to go once a mandatory change succeeds. */
  onDone?: () => void;
}

export function ChangePassword({ email, mandatory, onChange, onDone }: ChangePasswordProps) {
  const [values, setValues] = useState<PasswordChange>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // A mandatory redirect moves focus to the heading, so a screen-reader user is
  // told where they are and why instead of being relocated silently (ui-spec §10).
  useEffect(() => {
    if (mandatory) heading.current?.focus();
  }, [mandatory]);

  const set = (field: keyof PasswordChange) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  function validate(): Errors {
    const found: Errors = {};
    if (values.currentPassword === "") found.currentPassword = "Enter your current password.";
    const rule = checkNewPassword(values.newPassword, email);
    if (rule) found.newPassword = rule;
    else if (values.newPassword === values.currentPassword) found.newPassword = "Choose a password different from your current one.";
    if (values.confirmPassword !== values.newPassword) found.confirmPassword = "The passwords do not match.";
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);
    setDone(false);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await onChange(values);
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setDone(true);
      if (mandatory) onDone?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setErrors(error.fields as Errors);
      } else if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS") {
        // Only the field that was wrong is cleared (ui-spec §4.1).
        setValues((current) => ({ ...current, currentPassword: "" }));
        setProblem(error.message);
      } else {
        setProblem("The password could not be changed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <Card>
      <h1 ref={heading} tabIndex={-1} className={mandatory ? "tt-auth__brand" : undefined}>
        Change password
      </h1>
      {mandatory && <WarningCallout>Set your own password before continuing.</WarningCallout>}
      {done && !mandatory && <SuccessCallout>Password updated.</SuccessCallout>}
      {problem && (
        <div className="tt-callout tt-callout--error" role="alert" data-state="error">
          <span aria-hidden="true">⚠</span>
          <div>{problem}</div>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <TextInput label="Current password" type="password" name="currentPassword" autoComplete="current-password" required
          value={values.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} />
        <TextInput label="New password" type="password" name="newPassword" autoComplete="new-password" required
          help={PASSWORD_RULES} value={values.newPassword} onChange={set("newPassword")} error={errors.newPassword} />
        <TextInput label="Confirm new password" type="password" name="confirmPassword" autoComplete="new-password" required
          value={values.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
        <Button type="submit" variant="primary" busy={busy} busyLabel="Saving…">
          Save password
        </Button>
      </form>
    </Card>
  );

  return mandatory ? (
    <div className="tt-auth">
      <div className="tt-auth__card">{form}</div>
    </div>
  ) : (
    form
  );
}

export default ChangePassword;
