import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "../../src/screens/Login.js";
import { ApiError } from "../../src/api.js";

// Lab 3, Issue 5 — UI-01 to UI-04 in docs/lab-03/tests.md (ui-spec §3).

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(onSignIn: (email: string, password: string) => Promise<unknown> = vi.fn().mockResolvedValue(undefined)) {
  render(<Login onSignIn={onSignIn} />);
  return {
    email: screen.getByLabelText(/^Email/),
    password: screen.getByLabelText(/^Password/),
    submit: screen.getByRole("button", { name: "Sign in" }),
  };
}

describe("UI-01 validation, busy state, and one request per submission", () => {
  it("shows both required messages beneath their fields and sends nothing", async () => {
    const onSignIn = vi.fn();
    const { submit } = setup(onSignIn);
    await userEvent.click(submit);

    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute("aria-invalid", "true");
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const onSignIn = vi.fn();
    const { email, password, submit } = setup(onSignIn);
    await userEvent.type(email, "not-an-email");
    await userEvent.type(password, "anything-1");
    await userEvent.click(submit);

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it("is busy and disabled while signing in, and a double click sends one request", async () => {
    let finish!: () => void;
    const onSignIn = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { email, password, submit } = setup(onSignIn);
    await userEvent.type(email, "anucha.wong@kmutt.ac.th");
    await userEvent.type(password, "Toktickit#2026");

    await userEvent.dblClick(submit);
    const busy = screen.getByRole("button", { name: /Signing in/ });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledWith("anucha.wong@kmutt.ac.th", "Toktickit#2026");

    finish();
  });

  it("never trims the password", async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const { email, password, submit } = setup(onSignIn);
    await userEvent.type(email, "  anucha.wong@kmutt.ac.th  ");
    await userEvent.type(password, " spaced pass ");
    await userEvent.click(submit);
    expect(onSignIn).toHaveBeenCalledWith("anucha.wong@kmutt.ac.th", " spaced pass ");
  });
});

describe("UI-02 invalid credentials", () => {
  it("shows the API's single message and keeps both values", async () => {
    const onSignIn = vi.fn().mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect."));
    const { email, password, submit } = setup(onSignIn);
    await userEvent.type(email, "someone@toktickit.local");
    await userEvent.type(password, "Wrong-horse-1");
    await userEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(email).toHaveValue("someone@toktickit.local");
    expect(password).toHaveValue("Wrong-horse-1");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});

describe("UI-03 inactive account and lock-out", () => {
  it("shows the inactive-account message, distinct from invalid credentials", async () => {
    const onSignIn = vi.fn().mockRejectedValue(
      new ApiError(403, "ACCOUNT_INACTIVE", "This account is not active. Contact an administrator."),
    );
    const { email, password, submit } = setup(onSignIn);
    await userEvent.type(email, "wichai.boon@kmutt.ac.th");
    await userEvent.type(password, "Toktickit#2026");
    await userEvent.click(submit);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This account is not active. Contact an administrator.");
    expect(alert).not.toHaveTextContent("incorrect");
  });

  it("shows how long to wait after too many attempts (BR-67)", async () => {
    const onSignIn = vi.fn().mockRejectedValue(
      new ApiError(429, "TOO_MANY_ATTEMPTS", "Too many sign-in attempts. Try again in 15 minutes."),
    );
    const { email, password, submit } = setup(onSignIn);
    await userEvent.type(email, "someone@toktickit.local");
    await userEvent.type(password, "Wrong-horse-1");
    await userEvent.click(submit);

    expect(await screen.findByText("Too many sign-in attempts. Try again in 15 minutes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});

describe("UI-04 the API cannot be reached", () => {
  it("shows a safe message with Try again, which resubmits", async () => {
    const onSignIn = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(undefined);
    const { email, password, submit } = setup(onSignIn);
    await userEvent.type(email, "anucha.wong@kmutt.ac.th");
    await userEvent.type(password, "Toktickit#2026");
    await userEvent.click(submit);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Cannot reach TokTickIT right now.");
    expect(alert).not.toHaveTextContent(/fetch|TypeError/);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onSignIn).toHaveBeenCalledTimes(2);
  });
});
