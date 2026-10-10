import { FormEvent, useState } from "react";
import { ApiError } from "../api.js";
import { Button, Card, ErrorCallout, ErrorState, TextInput, WarningCallout } from "../components/index.js";

// Lab 3, Issue 5 — the Login screen (ui-spec §3, FR-01).
//
// No shell: the screen precedes the application, as the Requester selector did
// in Lab 2. Validation mirrors the server's for fast feedback, but the server
// decides (BR-01, BR-08, BR-16, BR-67).

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Problem = { tone: "error" | "warning" | "unavailable"; message: string } | null;

export interface LoginProps {
  onSignIn: (email: string, password: string) => Promise<unknown>;
}

export function Login({ onSignIn }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [problem, setProblem] = useState<Problem>(null);
  const [busy, setBusy] = useState(false);

  function validate() {
    const errors: { email?: string; password?: string } = {};
    const trimmed = email.trim();
    if (trimmed === "") errors.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(trimmed)) errors.email = "Enter a valid email address.";
    // Passwords are never trimmed: a space is a character the user chose.
    if (password === "") errors.password = "Enter your password.";
    return errors;
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setProblem(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      await onSignIn(email.trim(), password);
      // The router moves on from here; nothing more to render.
    } catch (error) {
      // Both fields keep their values, so a typo can be corrected (ui-spec §3.1).
      if (error instanceof ApiError) {
        if (error.code === "VALIDATION_FAILED") {
          setFieldErrors(error.fields);
        } else if (error.code === "TOO_MANY_ATTEMPTS") {
          setProblem({ tone: "warning", message: error.message });
        } else if (error.status === 401 || error.code === "ACCOUNT_INACTIVE") {
          // The API's own wording: one message for an unknown email and a
          // wrong password (AC-04), a separate one for an inactive account.
          setProblem({ tone: "error", message: error.message });
        } else {
          setProblem({ tone: "error", message: "Sign-in failed. Please try again." });
        }
      } else {
        setProblem({ tone: "unavailable", message: "Cannot reach TokTickIT right now. Please try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tt-auth">
      <div className="tt-auth__card">
        <Card>
          <h1 className="tt-auth__brand">TokTickIT</h1>
          <p className="tt-auth__lede">Sign in to continue</p>

          {problem?.tone === "error" && <ErrorCallout>{problem.message}</ErrorCallout>}
          {problem?.tone === "warning" && <WarningCallout>{problem.message}</WarningCallout>}
          {problem?.tone === "unavailable" && (
            // The API could not be reached: offer Try again (ui-spec §3.1),
            // which resubmits what is still in the fields.
            <ErrorState message={problem.message} onRetry={() => void submit()} />
          )}

          <form onSubmit={submit} noValidate>
            <TextInput
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email}
            />
            <TextInput
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
            />
            <Button type="submit" variant="primary" busy={busy} busyLabel="Signing in…">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default Login;
