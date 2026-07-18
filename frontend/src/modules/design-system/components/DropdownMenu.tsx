"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { useMenuKeyboardNav, useMounted, useOutsideClick } from "../hooks";
import styles from "./DropdownMenu.module.css";

type MenuContextValue = {
  close: () => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

const VIEWPORT_GAP = 8;
const MENU_GAP = 6;

export type MenuTriggerProps = {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
};

export type DropdownMenuProps = {
  /** Render prop for the trigger; spread the provided props onto a button. */
  trigger: (props: MenuTriggerProps, open: boolean) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  menuLabel?: string;
  className?: string;
  menuClassName?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
  minWidth: number;
};

function computeMenuPosition(
  trigger: DOMRect,
  menu: DOMRect | null,
  align: "start" | "end",
): MenuPosition {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const menuWidth = Math.min(
    menu?.width ?? Math.max(200, trigger.width),
    viewportWidth - VIEWPORT_GAP * 2,
  );
  const measuredHeight = menu?.height;

  const spaceBelow = viewportHeight - trigger.bottom - VIEWPORT_GAP;
  const spaceAbove = trigger.top - VIEWPORT_GAP;
  const estimated =
    measuredHeight ?? Math.min(280, Math.max(spaceBelow, spaceAbove));
  const openAbove =
    spaceBelow < Math.min(estimated, 240) && spaceAbove > spaceBelow;

  const available = openAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(120, available - MENU_GAP);
  const height = measuredHeight
    ? Math.min(measuredHeight, maxHeight)
    : Math.min(estimated, maxHeight);

  let left = align === "end" ? trigger.right - menuWidth : trigger.left;
  left = Math.min(
    Math.max(VIEWPORT_GAP, left),
    viewportWidth - menuWidth - VIEWPORT_GAP,
  );

  const top = openAbove
    ? Math.max(VIEWPORT_GAP, trigger.top - MENU_GAP - height)
    : trigger.bottom + MENU_GAP;

  return {
    top,
    left,
    maxHeight,
    minWidth: Math.max(200, trigger.width),
  };
}

export function DropdownMenu({
  trigger,
  children,
  align = "start",
  menuLabel,
  className = "",
  menuClassName = "",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const mounted = useMounted();
  const handleMenuKeys = useMenuKeyboardNav(menuRef);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useOutsideClick([menuRef, triggerRef], open, close);

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) {
      return;
    }

    const next = computeMenuPosition(
      triggerEl.getBoundingClientRect(),
      menuRef.current?.getBoundingClientRect() ?? null,
      align,
    );
    setPosition(next);
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Re-measure after paint so maxHeight / flip use the real menu size.
    const frame = requestAnimationFrame(() => {
      updatePosition();
      const first = menuRef.current?.querySelector<HTMLElement>(
        "[role='menuitem']:not([aria-disabled='true']), [role='menuitemradio']:not([aria-disabled='true'])",
      );
      first?.focus();
    });

    function onReposition() {
      updatePosition();
    }

    // Capture scroll from nested overflow containers (task table frames).
    window.addEventListener("resize", onReposition);
    document.addEventListener("scroll", onReposition, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  const contextValue = useMemo<MenuContextValue>(() => ({ close }), [close]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "Tab") {
      close();
      return;
    }

    handleMenuKeys(event);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
    }
  }

  const menuStyle: CSSProperties = {
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    maxHeight: position?.maxHeight,
    minWidth: position?.minWidth,
    visibility: position ? "visible" : "hidden",
  };

  const menu =
    open && mounted ? (
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={menuLabel}
        className={`${styles.menu} ${menuClassName}`.trim()}
        style={menuStyle}
        onKeyDown={onMenuKeyDown}
      >
        <MenuContext.Provider value={contextValue}>
          {children}
        </MenuContext.Provider>
      </div>
    ) : null;

  return (
    <div className={`${styles.wrapper} ${className}`.trim()}>
      {trigger(
        {
          ref: triggerRef,
          onClick: () => setOpen((current) => !current),
          onKeyDown: onTriggerKeyDown,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-controls": menuId,
        },
        open,
      )}
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

export type MenuItemProps = {
  onSelect?: () => void;
  icon?: ReactNode;
  description?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Renders as menuitemradio with a check mark when true/false. */
  selected?: boolean;
  closeOnSelect?: boolean;
  children: ReactNode;
};

export function MenuItem({
  onSelect,
  icon,
  description,
  disabled = false,
  danger = false,
  selected,
  closeOnSelect = true,
  children,
}: MenuItemProps) {
  const context = useContext(MenuContext);
  const isRadio = selected !== undefined;

  function handleSelect() {
    if (disabled) {
      return;
    }

    onSelect?.();

    if (closeOnSelect) {
      context?.close();
    }
  }

  return (
    <button
      type="button"
      role={isRadio ? "menuitemradio" : "menuitem"}
      aria-checked={isRadio ? selected : undefined}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      className={`${styles.item} ${danger ? styles.itemDanger : ""}`.trim()}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
    >
      {icon && (
        <span className={styles.itemIcon} aria-hidden>
          {icon}
        </span>
      )}
      <span className={styles.itemBody}>
        <span className={styles.itemLabel}>{children}</span>
        {description && (
          <span className={styles.itemDescription}>{description}</span>
        )}
      </span>
      {isRadio && selected && (
        <Check size={16} aria-hidden className={styles.itemCheck} />
      )}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className={styles.separator} />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className={styles.label}>{children}</div>;
}
