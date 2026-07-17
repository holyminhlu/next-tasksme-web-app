"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { useBodyScrollLock, useMounted } from "@/modules/design-system";
import {
  buildCommands,
  COMMAND_GROUP_LABELS,
  filterCommands,
  type Command,
  type CommandGroup,
} from "../commands";
import { useShell } from "../ShellProvider";
import { useShellActions } from "../useShellActions";
import styles from "./CommandPalette.module.css";

const GROUP_ORDER: CommandGroup[] = ["navigation", "actions", "preferences"];

export function CommandPalette() {
  const mounted = useMounted();
  const { commandPaletteOpen, setCommandPaletteOpen, navContext } = useShell();
  const runAction = useShellActions();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  useBodyScrollLock(commandPaletteOpen);

  const commands = useMemo(() => buildCommands(navContext), [navContext]);

  const results = useMemo(() => {
    const filtered = filterCommands(commands, query);

    return GROUP_ORDER.flatMap((group) =>
      filtered.filter((command) => command.group === group),
    );
  }, [commands, query]);

  // Reset state each time the palette opens and focus the input.
  useEffect(() => {
    if (!commandPaletteOpen) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset transient palette state on open
    setQuery("");
    setActiveIndex(0);

    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [commandPaletteOpen]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(
      "[data-active='true']",
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  if (!mounted || !commandPaletteOpen) {
    return null;
  }

  const activeCommand: Command | undefined = results[activeIndex];

  function close() {
    setCommandPaletteOpen(false);
  }

  function execute(command: Command) {
    close();
    runAction(command.action);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(results.length - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (activeCommand) {
          execute(activeCommand);
        }
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
    }
  }

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={styles.palette}
      >
        <div className={styles.inputRow}>
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={
              activeCommand ? `${listboxId}-${activeCommand.id}` : undefined
            }
            aria-label="Search commands and pages"
            placeholder="Search pages and actions..."
            className={styles.input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
          <span className={styles.escHint} aria-hidden>
            Esc
          </span>
        </div>

        {results.length === 0 ? (
          <p className={styles.empty} role="status">
            No results for “{query}”. Try a different search.
          </p>
        ) : (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Command results"
            className={styles.list}
          >
            {results.map((command, index) => {
              const Icon = command.icon;
              const active = index === activeIndex;
              const showGroupLabel =
                index === 0 || results[index - 1].group !== command.group;

              return (
                <li key={command.id} role="presentation">
                  {showGroupLabel && (
                    <p className={styles.groupLabel} aria-hidden>
                      {COMMAND_GROUP_LABELS[command.group]}
                    </p>
                  )}
                  <div
                    id={`${listboxId}-${command.id}`}
                    role="option"
                    aria-selected={active}
                    data-active={active || undefined}
                    className={`${styles.option} ${active ? styles.optionActive : ""}`.trim()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => execute(command)}
                  >
                    <span className={styles.optionIcon} aria-hidden>
                      <Icon size={16} />
                    </span>
                    <span className={styles.optionLabel}>{command.label}</span>
                    {command.hint && (
                      <span className={styles.optionHint}>{command.hint}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
