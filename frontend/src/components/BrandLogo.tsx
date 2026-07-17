import Image from "next/image";
import styles from "./BrandLogo.module.css";

type BrandLogoProps = {
  size?: "compact" | "default" | "large";
  priority?: boolean;
  className?: string;
};

export function BrandLogo({
  size = "default",
  priority = false,
  className = "",
}: BrandLogoProps) {
  const sizeClass =
    size === "compact"
      ? styles.compact
      : size === "large"
        ? styles.large
        : "";

  return (
    <span className={`${styles.logo} ${sizeClass} ${className}`.trim()}>
      <Image
        src="/TaskSME.png"
        alt="Task SME"
        width={1024}
        height={1024}
        priority={priority}
      />
    </span>
  );
}
