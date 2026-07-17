"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/modules/design-system";

export default function SettingsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/profile");
  }, [router]);

  return <LoadingState label="Opening settings..." />;
}
