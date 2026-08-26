import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TokTickITApp } from "../../src/TokTickITApp.js";
import { AppShell } from "../../src/components/AppShell.js";
import { RequesterProvider, STORAGE_KEY } from "../../src/context/RequesterContext.js";
import * as api from "../../src/api.js";
import type { Requester } from "../../src/api.js";

// Issue 4 AC-2, AC-3, AC-4 — selection flows into the shell, the shell shows
// the current Requester, and Change Requester returns to the selector.

const REQUESTERS: Requester[] = [
  { id: 1, fullName: "Anucha Wongsawat", email: "anucha.wong@kmutt.ac.th", department: "Civil Engineering" },
  { id: 3, fullName: "Pornchai Thana", email: "pornchai.than@kmutt.ac.th", department: "Library" },
];

beforeEach(() => {
  window.localStorage.clear();
  // The Lab 1 system-check panel is rendered inside the shell; stub it so these
  // tests exercise the requester flow only.
  vi.spyOn(api, "checkSystem").mockResolvedValue({ online: true, categories: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function mockRequesters(value: Requester[] | Error = REQUESTERS) {
  if (value instanceof Error) {
    return vi.spyOn(api, "fetchRequesters").mockRejectedValue(value);
  }
  return vi.spyOn(api, "fetchRequesters").mockResolvedValue(value);
}

async function selectRequester(name: RegExp, id: string) {
  await userEvent.selectOptions(await screen.findByLabelText(/Development Requester/), id);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByTestId("current-requester")).toHaveTextContent(name);
}

describe("selection gates the application", () => {
  it("shows the Selection screen when nothing is selected", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
    expect(screen.queryByTestId("current-requester")).not.toBeInTheDocument();
  });

  it("loads the dropdown from the API rather than hard-coded names", async () => {
    const spy = mockRequesters();
    render(<TokTickITApp />);

    await screen.findByLabelText(/Development Requester/);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("option", { name: /Anucha Wongsawat/ })).toBeInTheDocument();
  });

  it("enters the application once Continue is pressed", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    await selectRequester(/Pornchai Thana/, "3");
    expect(screen.queryByLabelText(/Development Requester/)).not.toBeInTheDocument();
  });
});

describe("application shell", () => {
  it("displays the selected Requester's name", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    await selectRequester(/Pornchai Thana/, "3");
    expect(screen.getByTestId("current-requester")).toHaveTextContent("Pornchai Thana");
  });

  it("offers a Change Requester action", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    await selectRequester(/Pornchai Thana/, "3");
    expect(screen.getByRole("button", { name: "Change Requester" })).toBeInTheDocument();
  });

  it("returns to the Selection screen when Change Requester is used", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    await selectRequester(/Pornchai Thana/, "3");
    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
    expect(screen.queryByTestId("current-requester")).not.toBeInTheDocument();
  });

  it("lets a different Requester be chosen afterwards", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    await selectRequester(/Pornchai Thana/, "3");
    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));
    await selectRequester(/Anucha Wongsawat/, "1");

    // No trace of the previous Requester survives the switch (BR-11).
    expect(screen.getByTestId("current-requester")).not.toHaveTextContent("Pornchai Thana");
  });

  it("keeps the testing-only caveat visible inside the application", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    await selectRequester(/Pornchai Thana/, "3");
    expect(screen.getByRole("note")).toHaveTextContent(/testing only, not a login/i);
  });
});

describe("selection persistence", () => {
  it("stores the selection on the client, never as a server session", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    await selectRequester(/Pornchai Thana/, "3");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("3");
  });

  it("clears the stored selection on Change Requester", async () => {
    mockRequesters();
    render(<TokTickITApp />);

    await selectRequester(/Pornchai Thana/, "3");
    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("restores a stored selection that is still active", async () => {
    window.localStorage.setItem(STORAGE_KEY, "3");
    mockRequesters();
    render(<TokTickITApp />);

    expect(await screen.findByTestId("current-requester")).toHaveTextContent("Pornchai Thana");
  });

  it("discards a stored id that is no longer active", async () => {
    // Requester 99 was deactivated since the last visit, so the API no longer
    // returns it and the stale localStorage value must not resurrect it.
    window.localStorage.setItem(STORAGE_KEY, "99");
    mockRequesters();
    render(<TokTickITApp />);

    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
  });

  it("ignores a corrupted stored value", async () => {
    window.localStorage.setItem(STORAGE_KEY, "not-a-number");
    mockRequesters();
    render(<TokTickITApp />);

    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
  });
});

describe("failure and empty states end to end", () => {
  it("shows the safe failure state when the requesters API is down", async () => {
    mockRequesters(new Error("network down"));
    render(<TokTickITApp />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Cannot load Development Requesters/i);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("recovers when Try again succeeds", async () => {
    const spy = vi
      .spyOn(api, "fetchRequesters")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(REQUESTERS);

    render(<TokTickITApp />);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText(/Development Requester/)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("shows the empty state when no requester is active", async () => {
    mockRequesters([]);
    render(<TokTickITApp />);

    expect(await screen.findByText(/No active Development Requesters found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("shell without a provider", () => {
  it("refuses to render outside a RequesterProvider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<AppShell>child</AppShell>)).toThrow(/RequesterProvider/);
    quiet.mockRestore();
  });

  it("renders no requester block when none is selected", () => {
    render(
      <RequesterProvider available={REQUESTERS}>
        <AppShell>child</AppShell>
      </RequesterProvider>,
    );

    expect(screen.queryByTestId("current-requester")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
  });
});
