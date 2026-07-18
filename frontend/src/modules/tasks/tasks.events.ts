/** Lightweight cross-page refresh signal for task mutations. */

export const TASKS_CHANGED_EVENT = "taskmng:tasks-changed";

export function emitTasksChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
}

export function subscribeTasksChanged(handler: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = () => handler();
  window.addEventListener(TASKS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(TASKS_CHANGED_EVENT, listener);
}
