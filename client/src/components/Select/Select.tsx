import type { ComponentPropsWithoutRef } from "react";
import styles from "./Select.module.css";

/** A native <select> with the app's styling. All native props pass through. */
export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={className ? `${styles.select} ${className}` : styles.select} {...props} />;
}
