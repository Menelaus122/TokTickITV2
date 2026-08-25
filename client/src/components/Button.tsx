import { ButtonHTMLAttributes, ReactNode } from "react";

// Button — the four variants from ui-spec.md 4 plus the busy state.
//
// Every button shows visible text; icons may support it but never replace it.
// A busy button is disabled for the whole in-flight request (BR-30), which is
// what stops a double click from creating two tickets.

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  /** Shows a spinner, swaps the label, and disables the button. */
  busy?: boolean;
  /** Label shown while busy. Defaults to "Working…". */
  busyLabel?: string;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  busy = false,
  busyLabel = "Working…",
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = ["tt-btn", `tt-btn--${variant}`];
  if (busy) classes.push("tt-btn--busy");

  return (
    <button
      type={type}
      className={classes.join(" ")}
      // Busy implies disabled: one in-flight request at a time.
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span className="tt-spinner" aria-hidden="true" />}
      <span>{busy ? busyLabel : children}</span>
    </button>
  );
}

// IconButton — an icon-only control. The accessible label is required by the
// type, so it cannot be forgotten, and it doubles as the tooltip (ui-spec.md 4).
export interface IconButtonProps extends Omit<ButtonProps, "children" | "variant"> {
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
}

export function IconButton({ label, icon, variant = "tertiary", ...rest }: IconButtonProps) {
  return (
    <Button variant={variant} aria-label={label} title={label} {...rest}>
      <span aria-hidden="true">{icon}</span>
    </Button>
  );
}

export default Button;
