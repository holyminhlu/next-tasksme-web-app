"use client";

import { Suspense } from "react";
import { AuthGate } from "@/modules/auth";
import { LoadingState, ToastProvider } from "@/modules/design-system";
import { AppShell, ShellProvider } from "@/modules/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingState label="Loading session..." />}>
      <AuthGate requireWorkspace>
        <ToastProvider>
          <ShellProvider>
            <AppShell>{children}</AppShell>
          </ShellProvider>
        </ToastProvider>
      </AuthGate>
    </Suspense>
  );
}
