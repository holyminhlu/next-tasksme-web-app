"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Check } from "lucide-react";
import { useMenuKeyboardNav, useOutsideClick } from "../hooks";
import styles from "./DropdownMenu.module.css";

type MenuContextValue = {
  close: () => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

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

export function DropdownMenu({
  trigger,
  children,
  align = "start",
  menuLabel,
  className = "",
  menuClassName = "",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const handleMenuKeys = useMenuKeyboardNav(menuRef);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useOutsideClick([menuRef, triggerRef], open, close);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Move focus to the first enabled item once the menu renders.
    const frame = requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLElement>(
        "[role='menuitem']:not([aria-disabled='true']), [role='menuitemradio']:not([aria-disabled='true'])",
      );
      first?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

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
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={menuLabel}
          className={`${styles.menu} ${align === "end" ? styles.alignEnd : styles.alignStart} ${menuClassName}`.trim()}
          onKeyDown={onMenuKeyDown}
        >
          <MenuContext.Provider value={contextValue}>
            {children}
          </MenuContext.Provider>
        </div>
      )}
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
