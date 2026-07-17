"use client";

import { useEffect, useState } from "react";

export type Viewport = "mobile" | "tablet" | "desktop";

const TABLET_QUERY = "(min-width: 768px)";
const DESKTOP_QUERY = "(min-width: 1024px)";

function currentViewport(): Viewport {
  if (typeof window === "undefined") {
    return "desktop";
  }

  if (window.matchMedia(DESKTOP_QUERY).matches) {
    return "desktop";
  }

  return window.matchMedia(TABLET_QUERY).matches ? "tablet" : "mobile";
}

/** Breakpoint bucket kept in sync with the shell layout CSS. */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>("desktop");

  useEffect(() => {
    const queries = [TABLET_QUERY, DESKTOP_QUERY].map((query) =>
      window.matchMedia(query),
    );

    const update = () => {
      setViewport(currentViewport());
    };

    update();

    for (const query of queries) {
      query.addEventListener("change", update);
    }

    return () => {
      for (const query of queries) {
        query.removeEventListener("change", update);
      }
    };
  }, []);

  return viewport;
}
