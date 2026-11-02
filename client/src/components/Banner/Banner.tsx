import styles from "./Banner.module.css";

interface BannerProps {
  /** `error` is announced immediately to screen readers; `notice` is announced politely. */
  variant: "error" | "notice";
  message: string;
}

export function Banner({ variant, message }: BannerProps) {
  return (
    <p role={variant === "error" ? "alert" : "status"} className={`${styles.banner} ${styles[variant]}`}>
      {message}
    </p>
  );
}
