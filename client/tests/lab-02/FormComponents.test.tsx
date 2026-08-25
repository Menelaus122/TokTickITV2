import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextInput, TextArea, SelectInput, ReadOnlyField } from "../../src/components/Inputs.js";

// Issue 3 AC-3 — validation and alert presentation obeys the UI rules:
// a red asterisk on required fields and the message rendered beneath the field.

describe("required-field marker", () => {
  it("renders a red asterisk beside a required label", () => {
    const { container } = render(<TextInput label="Ticket Summary" required />);
    const asterisk = container.querySelector(".tt-field__required");

    expect(asterisk).not.toBeNull();
    expect(asterisk).toHaveTextContent("*");
    // Hidden from screen readers: the required attribute already conveys it.
    expect(asterisk).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByLabelText(/Ticket Summary/)).toBeRequired();
  });

  it("omits the asterisk on an optional field", () => {
    const { container } = render(<TextInput label="Department" />);
    expect(container.querySelector(".tt-field__required")).toBeNull();
  });

  it("shows the asterisk AND the message when a required field is invalid", () => {
    // The asterisk must never stand in for the validation message.
    const { container } = render(
      <TextInput label="Ticket Summary" required error="Summary is required." />,
    );
    expect(container.querySelector(".tt-field__required")).not.toBeNull();
    expect(screen.getByText("Summary is required.")).toBeInTheDocument();
  });
});

describe("validation message placement", () => {
  it("renders the message inside the field group, immediately after the control", () => {
    const { container } = render(<TextInput label="Ticket Summary" error="Too short." />);

    const group = container.querySelector(".tt-field")!;
    const control = group.querySelector(".tt-field__control")!;
    const message = group.querySelector(".tt-field__message")!;

    expect(message).toHaveTextContent("Too short.");
    // Same group, and the message follows the control in DOM order — not a
    // lone summary at the top of the form.
    expect(group.contains(control)).toBe(true);
    expect(control.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("wires the message to the control for assistive technology", () => {
    render(<TextInput label="Ticket Summary" error="Too short." />);
    const control = screen.getByLabelText(/Ticket Summary/);

    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAccessibleDescription("Too short.");
    expect(control.className).toContain("tt-field__control--invalid");
  });

  it("carries no invalid state when there is no error", () => {
    render(<TextInput label="Ticket Summary" help="Keep it short." />);
    const control = screen.getByLabelText(/Ticket Summary/);

    expect(control).not.toHaveAttribute("aria-invalid");
    expect(control.className).not.toContain("--invalid");
    expect(control).toHaveAccessibleDescription("Keep it short.");
  });

  it("hides the hint while an error is showing so the two never overlap", () => {
    render(<TextInput label="Ticket Summary" help="Keep it short." error="Too short." />);
    expect(screen.queryByText("Keep it short.")).not.toBeInTheDocument();
    expect(screen.getByText("Too short.")).toBeInTheDocument();
  });
});

describe("read-only vs editable fields", () => {
  it("marks a read-only field distinctly and keeps it readable", () => {
    render(<ReadOnlyField label="Ticket Number" value="TT-2026-00042" />);
    const control = screen.getByLabelText("Ticket Number");

    expect(control).toHaveAttribute("readonly");
    expect(control.className).toContain("tt-field__control--readonly");
    expect(control).toHaveValue("TT-2026-00042");
    // Read-only is not disabled: the value is real and must stay legible.
    expect(control).not.toBeDisabled();
  });

  it("leaves an editable field without the read-only styling", () => {
    render(<TextInput label="Ticket Summary" />);
    const control = screen.getByLabelText("Ticket Summary");

    expect(control).not.toHaveAttribute("readonly");
    expect(control.className).not.toContain("--readonly");
  });
});

describe("labels and controls", () => {
  it("associates every control with a label above it", () => {
    render(
      <>
        <TextInput label="Ticket Summary" />
        <TextArea label="Description" />
        <SelectInput label="Category" options={[{ value: 1, label: "Hardware" }]} />
      </>,
    );

    expect(screen.getByLabelText("Ticket Summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
  });

  it("gives each field its own ids so two fields never collide", () => {
    render(
      <>
        <TextInput label="First" error="A" />
        <TextInput label="Second" error="B" />
      </>,
    );

    const first = screen.getByLabelText("First");
    const second = screen.getByLabelText("Second");

    expect(first.id).not.toBe(second.id);
    expect(first).toHaveAccessibleDescription("A");
    expect(second).toHaveAccessibleDescription("B");
  });

  it("renders select options from data rather than hard-coded markup", () => {
    render(
      <SelectInput
        label="Related System"
        placeholder="Choose…"
        options={[
          { value: 1, label: "Email" },
          { value: 2, label: "VPN" },
        ]}
      />,
    );

    expect(screen.getByRole("option", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "VPN" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Choose…" })).toBeInTheDocument();
  });
});
