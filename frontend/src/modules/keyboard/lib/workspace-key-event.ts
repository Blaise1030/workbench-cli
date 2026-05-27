import { eventToChord, normalizeStoredChord } from "../chord";
import type { KeybindingAction, KeybindingsMap } from "../types";

/** Elements that should keep normal typing / native shortcuts (settings forms, commit box, etc.). */
export const NATIVE_KEYBOARD_SELECTOR = "[data-native-keyboard]";

export function isNativeKeyboardTarget(event: KeyboardEvent): boolean {
  const el = event.target;
  if (!el || typeof (el as HTMLElement).closest !== "function") return false;
  return Boolean((el as HTMLElement).closest(NATIVE_KEYBOARD_SELECTOR));
}

export function matchWorkspaceKeyAction(
  event: KeyboardEvent,
  map: KeybindingsMap,
): KeybindingAction | null {
  if (isNativeKeyboardTarget(event)) return null;

  const chord = eventToChord(event);
  if (!chord) return null;

  const matched = (Object.keys(map) as KeybindingAction[]).find(
    (action) => normalizeStoredChord(map[action]) === chord,
  );
  return matched ?? null;
}

export function consumeWorkspaceKeyEvent(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
