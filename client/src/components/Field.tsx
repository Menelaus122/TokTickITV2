import { ReactNode, useId } from "react";

// Field — the one place label / required marker / control / validation message
// are wired together (ui-spec.md 3.1 and 3.2).
//
// Two rules this component exists to make impossible to get wrong:
//   * a required field shows a red asterisk, and the asterisk NEVER stands in
//     for the validation message; both appear when a required field is invalid;
//   * the message renders directly beneath its own control, inside the field
//     group, and is announced to screen readers through aria-describedby.

export interface FieldProps {
  label: string;
  required?: boolean;
  /** Validation message. When present the control is marked invalid. */
  error?: string;
  /** Non-error hint shown under the control. Hidden while an error is shown. */
  help?: string;
  /** Receives the ids and state the control must carry. */
  children: (control: FieldControlProps) => ReactNode;
}

export interface FieldControlProps {
  id: string;
  className: string;
  "aria-invalid": boolean | undefined;
  "aria-describedby": string | undefined;
  required: boolean | undefined;
}

export function Field({ label, required, error, help, children }: FieldProps) {
  const base = useId();
  const controlId = `${base}-control`;
  const messageId = `${base}-message`;
  const helpId = `${base}-help`;

  const describedBy = error ? messageId : help ? helpId : undefined;

  return (
    <div className="tt-field">
      <label className="tt-field__label" htmlFor={controlId}>
        {label}
        {required && (
          // aria-hidden: the requirement is already conveyed by the required
          // attribute on the control, so screen readers do not hear "asterisk".
          <span className="tt-field__required" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id: controlId,
        className: `tt-field__control${error ? " tt-field__control--invalid" : ""}`,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        required: required || undefined,
      })}

      {error && (
        <span className="tt-field__message" id={messageId} role="alert">
          {error}
        </span>
      )}

      {!error && help && (
        <span className="tt-field__help" id={helpId}>
          {help}
        </span>
      )}
    </div>
  );
}

export default Field;
