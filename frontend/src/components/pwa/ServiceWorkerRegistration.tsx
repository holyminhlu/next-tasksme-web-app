"use client";

import { useEffect, useRef, useState } from "react";
import { UpdatePrompt } from "./UpdatePrompt";

/**
 * Registers /sw.js (production only) and surfaces an update prompt when a
 * new service worker version is waiting to activate. Intended to be mounted
 * once from the root layout.
 */
export function ServiceWorkerRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let disposed = false;

    const trackWaiting = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) {
          return;
        }
        installing.addEventListener("statechange", () => {
          if (
            !disposed &&
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setWaitingWorker(installing);
          }
        });
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (!disposed) {
          trackWaiting(registration);
        }
      })
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });

    const handleControllerChange = () => {
      if (reloadingRef.current) {
        return;
      }
      reloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  if (!waitingWorker) {
    return null;
  }

  return (
    <UpdatePrompt
      onUpdate={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })}
      onDismiss={() => setWaitingWorker(null)}
    />
  );
}
