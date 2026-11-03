import type { ComponentPropsWithoutRef } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "danger";
type Size = "md" | "sm";

/** The class names for a button look, for elements that are not <button>, such as links. */
export function buttonClassName(variant: Variant, size: Size = "md"): string {
  return [styles.button, styles[variant], size === "sm" && styles.sm].filter(Boolean).join(" ");
}

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
  size?: Size;
}

/** A native <button> with the app's styling. All native props pass through, including `type`. */
export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  const classes = buttonClassName(variant, size);
  // The caller decides `type`: forms need both "submit" and "button" buttons.
  return <button className={className ? `${classes} ${className}` : classes} {...props} />;
}
