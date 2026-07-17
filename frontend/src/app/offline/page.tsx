import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { StatusScreen } from "@/components/pwa/StatusScreen";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = {
  title: "You are offline | Task SME",
};

// Must be statically rendered so the service worker can precache it.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <StatusScreen
      icon={<WifiOff size={28} aria-hidden="true" />}
      title="You are offline"
      description="Task SME could not reach the network. Check your internet connection, then try again. Any unsaved changes are kept on this device until you reconnect."
      actions={<RetryButton />}
    />
  );
}
