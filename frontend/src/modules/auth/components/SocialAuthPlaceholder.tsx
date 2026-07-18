import styles from "../auth.module.css";

type SocialAuthPlaceholderProps = {
  mode: "login" | "register";
};

function GitHubIcon() {
  return (
    <svg
      className={styles.providerLogo}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .26.18.59.69.48A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"
      />
    </svg>
  );
}

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
          title="GitHub OAuth sẽ được hỗ trợ trong phiên bản sau"
        >
          <GitHubIcon />
          {action} với GitHub
          <span className={styles.comingSoon}>Sắp ra mắt</span>
        </button>

        <button
          type="button"
          className={styles.socialButton}
          disabled
          title="Google OAuth sẽ được hỗ trợ trong phiên bản sau"
        >
          <svg
            className={styles.providerLogo}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.39 13.93a6.01 6.01 0 0 1 0-3.86V7.45H3.04a10 10 0 0 0 0 9.1l3.35-2.62Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
            />
          </svg>
          {action} với Google
          <span className={styles.comingSoon}>Sắp ra mắt</span>
        </button>

        <button
          type="button"
          className={styles.socialButton}
          disabled
          title="Microsoft OAuth sẽ được hỗ trợ trong phiên bản sau"
        >
          <svg
            className={styles.providerLogo}
            viewBox="0 0 23 23"
            aria-hidden="true"
          >
            <path fill="#F25022" d="M1 1h10v10H1z" />
            <path fill="#7FBA00" d="M12 1h10v10H12z" />
            <path fill="#00A4EF" d="M1 12h10v10H1z" />
            <path fill="#FFB900" d="M12 12h10v10H12z" />
          </svg>
          {action} với Microsoft
          <span className={styles.comingSoon}>Sắp ra mắt</span>
        </button>
      </div>
    </div>
  );
}
