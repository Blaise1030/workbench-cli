import { describe, expect, it } from "vitest";
import { KEYBINDING_OPTIONS } from "../options";
import { isNativeKeyboardTarget, matchWorkspaceKeyAction } from "./workspace-key-event";

function targetWithNativeFlag(native: boolean): EventTarget {
  return {
    closest: (selector: string) =>
      native && selector === "[data-native-keyboard]" ? ({} as Element) : null,
  } as unknown as HTMLElement;
}

function fakeKeydown(
  init: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean },
  target: EventTarget,
): KeyboardEvent {
  return { ...init, target } as KeyboardEvent;
}

describe("isNativeKeyboardTarget", () => {
  it("returns true inside data-native-keyboard", () => {
    expect(isNativeKeyboardTarget(fakeKeydown({ key: "a" }, targetWithNativeFlag(true)))).toBe(
      true,
    );
  });

  it("returns false for terminal-like targets without the attribute", () => {
    expect(
      isNativeKeyboardTarget(
        fakeKeydown({ key: "a", ctrlKey: true, shiftKey: true }, targetWithNativeFlag(false)),
      ),
    ).toBe(false);
  });
});

describe("matchWorkspaceKeyAction", () => {
  it("matches workspace chords on non-native targets", () => {
    expect(
      matchWorkspaceKeyAction(
        fakeKeydown({ key: "¡", altKey: true }, targetWithNativeFlag(false)),
        KEYBINDING_OPTIONS,
      ),
    ).toBe("terminal.tab.1");
  });

  it("skips native keyboard targets", () => {
    expect(
      matchWorkspaceKeyAction(
        fakeKeydown({ key: "¡", altKey: true }, targetWithNativeFlag(true)),
        KEYBINDING_OPTIONS,
      ),
    ).toBeNull();
  });
});
