import styles from "./Banner.module.css";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p role="alert" className={`${styles.banner} ${styles.error}`}>
      {message}
    </p>
  );
}
