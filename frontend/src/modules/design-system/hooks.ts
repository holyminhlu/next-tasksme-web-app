"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.offsetParent !== null || element === document.activeElement);
}

/**
 * Traps Tab focus inside `containerRef` while `active`, restores focus to the
 * previously focused element on deactivation, and calls `onEscape` on Escape.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  const restoreRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const container = containerRef.current;

    if (container) {
      const initial =
        container.querySelector<HTMLElement>("[data-autofocus]") ??
        getFocusable(container)[0] ??
        container;
      initial.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const trapped = containerRef.current;
      if (!trapped) {
        return;
      }

      const focusable = getFocusable(trapped);
      if (focusable.length === 0) {
        event.preventDefault();
        trapped.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || current === trapped)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      restoreRef.current?.focus();
    };
  }, [active, containerRef]);
}

/** Calls `handler` when a pointer press starts outside every provided ref. */
export function useOutsideClick(
  refs: Array<RefObject<HTMLElement | null>>,
  active: boolean,
  handler: () => void,
) {
  const handlerRef = useRef(handler);
  const refsRef = useRef(refs);

  useEffect(() => {
    handlerRef.current = handler;
    refsRef.current = refs;
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inside = refsRef.current.some((ref) =>
        ref.current ? ref.current.contains(target) : false,
      );

      if (!inside) {
        handlerRef.current();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [active]);
}

/** True once the component has mounted on the client (safe for portals). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-mount flag for portals
    setMounted(true);
  }, []);

  return mounted;
}

/** Locks body scroll while `locked` (dialogs, drawers, mobile nav). */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

/** Stable ids for label/description wiring in composite widgets. */
export function useFieldIds(explicitId?: string) {
  const generated = useId();
  const id = explicitId ?? `field-${generated}`;

  return {
    id,
    labelId: `${id}-label`,
    hintId: `${id}-hint`,
    errorId: `${id}-error`,
  };
}

/** Roving focus for menu-like widgets; moves focus among role="menuitem". */
export function useMenuKeyboardNav(
  menuRef: RefObject<HTMLElement | null>,
) {
  return useCallback(
    (event: React.KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu) {
        return;
      }

      const items = Array.from(
        menu.querySelectorAll<HTMLElement>(
          "[role='menuitem']:not([aria-disabled='true']), [role='menuitemradio']:not([aria-disabled='true'])",
        ),
      );

      if (items.length === 0) {
        return;
      }

      const currentIndex = items.findIndex(
        (item) => item === document.activeElement,
      );

      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowDown":
          nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
          break;
        case "ArrowUp":
          nextIndex =
            currentIndex < 0
              ? items.length - 1
              : (currentIndex - 1 + items.length) % items.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      items[nextIndex]?.focus();
    },
    [menuRef],
  );
}
