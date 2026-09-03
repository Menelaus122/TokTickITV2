import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterSelection } from "../../src/screens/RequesterSelection.js";
import type { Requester } from "../../src/api.js";

// Issue 4 AC-1, AC-2, AC-4 — the Development Requester Selection screen.

const REQUESTERS: Requester[] = [
  { id: 1, fullName: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th", department: "Civil Engineering" },
  { id: 2, fullName: "Kanya Srisai", email: "kanya.sris@kmutt.ac.th", department: "Registrar" },
  { id: 3, fullName: "Pornchai Thana", email: "pornchai.than@kmutt.ac.th", department: "Library" },
  { id: 4, fullName: "Suchada Meesuk", email: "suchada.mees@kmutt.ac.th", department: "Finance" },
];

function renderScreen(props: Partial<Parameters<typeof RequesterSelection>[0]> = {}) {
  const onContinue = vi.fn();
  const onRetry = vi.fn();
  const view = render(
    <RequesterSelection
      status="ready"
      requesters={REQUESTERS}
      onContinue={onContinue}
      onRetry={onRetry}
      {...props}
    />,
  );
  return { onContinue, onRetry, container: view.container };
}

describe("dropdown of active requesters", () => {
  it("offers one option per requester supplied by the API", () => {
    renderScreen();

    for (const requester of REQUESTERS) {
      expect(
        screen.getByRole("option", { name: new RegExp(requester.fullName) }),
      ).toBeInTheDocument();
    }
  });

  it("shows no requester the API did not return", () => {
    // The backend filters inactive requesters out, so an inactive name must
    // never appear here.
    renderScreen();
    expect(screen.queryByRole("option", { name: /Wichai Boonmee/ })).not.toBeInTheDocument();
  });

  it("renders options from data, showing name and department", () => {
    renderScreen();
    expect(
      screen.getByRole("option", { name: "Pornchai Thana — Library" }),
    ).toBeInTheDocument();
  });

  it("gives the dropdown a keyboard-accessible label", () => {
    renderScreen();
    const select = screen.getByLabelText(/Development Requester/);

    expect(select.tagName).toBe("SELECT");
    expect(select).toBeRequired();
  });
});

describe("Continue action", () => {
  it("is disabled until a requester is chosen", async () => {
    renderScreen();
    const button = screen.getByRole("button", { name: "Continue" });

    expect(button).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText(/Development Requester/), "3");
    expect(button).toBeEnabled();
  });

  it("hands the chosen requester to the application", async () => {
    const { onContinue } = renderScreen();

    await userEvent.selectOptions(screen.getByLabelText(/Development Requester/), "3");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith(REQUESTERS[2]);
  });
});

describe("loading state", () => {
  it("shows a loading indicator and no dropdown", () => {
    const { container } = renderScreen({ status: "loading", requesters: [] });

    // Queried by marker, not by role: the testing caveat above is also a live
    // region, so "status" alone is ambiguous on this screen.
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("empty state", () => {
  it("explains that no active requesters exist and keeps Continue disabled", () => {
    renderScreen({ status: "ready", requesters: [] });

    expect(screen.getByText(/No active Development Requesters found/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("API failure state", () => {
  it("shows a safe message with a retry action and no dropdown", async () => {
    const { onRetry } = renderScreen({
      status: "error",
      requesters: [],
      errorMessage: "Cannot load Development Requesters. Make sure the TokTickIT API is running, then try again.",
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Cannot load Development Requesters/i);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("leaks no internal detail in the failure message", () => {
    renderScreen({ status: "error", requesters: [] });

    const text = screen.getByRole("alert").textContent ?? "";
    expect(text).not.toMatch(/http|500|stack|prisma|select |at .*\.ts/i);
  });
});

describe("this is not a login screen", () => {
  it("states the Lab 2 testing caveat verbatim", () => {
    renderScreen();

    expect(
      screen.getByText(/Select a Development Requester to test requester-specific ticket behavior\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/This is not a login screen\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Authentication and role-based access will be introduced in Lab 3\./i),
    ).toBeInTheDocument();
  });

  it("asks for no password or credential of any kind", () => {
    const { container } = renderScreen();

    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in|log in|login/i })).not.toBeInTheDocument();
  });

  it("presents the caveat as a warning rather than ordinary text", () => {
    const { container } = renderScreen();
    expect(container.querySelector(".tt-callout--warning")).not.toBeNull();
  });
});
