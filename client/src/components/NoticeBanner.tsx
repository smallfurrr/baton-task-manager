import styles from "./Banner.module.css";

export function NoticeBanner({ message }: { message: string }) {
  return (
    <p role="status" className={`${styles.banner} ${styles.notice}`}>
      {message}
    </p>
  );
}
