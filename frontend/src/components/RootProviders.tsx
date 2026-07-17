"use client";

import type { ReactNode } from "react";
import { InstallPrompt, ServiceWorkerRegistration } from "@/components/pwa";

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ServiceWorkerRegistration />
      <InstallPrompt />
    </>
  );
}
