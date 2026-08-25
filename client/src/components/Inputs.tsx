import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Field } from "./Field.js";

// Form controls built on Field, so every one of them inherits the label,
// required marker, validation placement, and aria wiring for free.

type Common = {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
};

// --- Single-line text ------------------------------------------------------

export type TextInputProps = Common &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "required">;

export function TextInput({ label, required, error, help, ...rest }: TextInputProps) {
  return (
    <Field label={label} required={required} error={error} help={help}>
      {(control) => <input type="text" {...control} {...rest} />}
    </Field>
  );
}

// --- Read-only display -----------------------------------------------------

// A value the Requester should read but cannot change (Ticket Number, Ticket
// Date, Requester). Deliberately an input marked readOnly rather than a
// disabled one: disabled means "an action you cannot take right now", read-only
// means "a real value that is not yours to edit" (ui-spec.md 3).
export type ReadOnlyFieldProps = Common & {
  value: string;
  name?: string;
};

export function ReadOnlyField({ label, value, name, help }: ReadOnlyFieldProps) {
  return (
    <Field label={label} help={help}>
      {(control) => (
        <input
          {...control}
          className={`${control.className} tt-field__control--readonly`}
          name={name}
          value={value}
          readOnly
        />
      )}
    </Field>
  );
}

// --- Multiline -------------------------------------------------------------

export type TextAreaProps = Common &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id" | "required">;

export function TextArea({ label, required, error, help, rows = 6, ...rest }: TextAreaProps) {
  return (
    <Field label={label} required={required} error={error} help={help}>
      {(control) => <textarea rows={rows} {...control} {...rest} />}
    </Field>
  );
}

// --- Select ----------------------------------------------------------------

export interface SelectOption {
  value: string | number;
  label: string;
}

export type SelectInputProps = Common &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id" | "required"> & {
    options: SelectOption[];
    placeholder?: string;
  };

export function SelectInput({
  label,
  required,
  error,
  help,
  options,
  placeholder,
  ...rest
}: SelectInputProps) {
  return (
    <Field label={label} required={required} error={error} help={help}>
      {(control) => (
        <select {...control} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
