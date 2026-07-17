import styles from "../auth.module.css";

type SocialAuthPlaceholderProps = {
  mode: "login" | "register";
};

export function SocialAuthPlaceholder({
  mode,
}: SocialAuthPlaceholderProps) {
  const action = mode === "login" ? "Đăng nhập" : "Đăng ký";

  return (
    <div className={styles.socialAuth} aria-label="Đăng nhập mạng xã hội sắp ra mắt">
      <div className={styles.divider}>
        <span>Hoặc tiếp tục với</span>
      </div>

      <div className={styles.socialButtons}>
        <button
          type="button"
          className={styles.socialButton}
          disabled
          title="Google OAuth sẽ được hỗ trợ trong phiên bản sau"
        >
          <span className={styles.googleMark} aria-hidden="true">
            G
          </span>
          {action} với Google
          <span className={styles.comingSoon}>Sắp ra mắt</span>
        </button>

        <button
          type="button"
          className={styles.socialButton}
          disabled
          title="Microsoft OAuth sẽ được hỗ trợ trong phiên bản sau"
        >
          <span className={styles.microsoftMark} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          {action} với Microsoft
          <span className={styles.comingSoon}>Sắp ra mắt</span>
        </button>
      </div>
    </div>
  );
}
