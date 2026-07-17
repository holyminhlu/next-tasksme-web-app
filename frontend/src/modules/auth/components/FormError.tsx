import styles from "../auth.module.css";

type FormErrorProps = {
  message?: string | null;
};

export function FormError({ message }: FormErrorProps) {
  if (!message) {
    return null;
  }

  return <div className={styles.error}>{message}</div>;
}
