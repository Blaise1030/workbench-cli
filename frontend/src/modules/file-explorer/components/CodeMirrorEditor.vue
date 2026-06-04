<script setup lang="ts">
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
import { onBeforeUnmount, onMounted, watch } from "vue";
import {
  clearAnnotationsEffect,
  codemirrorInlineAnnotationExtension,
} from "@/modules/context-queue/lib/codemirror-inline-annotation";
import { ref } from "vue";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";
import { detectLanguage } from "@/modules/file-explorer/lib/detect-language";

const props = defineProps<{
  filePath: string;
  content: string;
  scrollTop?: number;
}>();

const emit = defineEmits<{
  save: [filePath: string, content: string];
  change: [isDirty: boolean];
}>();

const containerRef = ref<HTMLElement | null>(null);
let view: EditorView | null = null;
const { colorMode } = useAppColorMode();

const themeCompartment = new Compartment();
const languageCompartment = new Compartment();

/** Set to true during programmatic document resets to suppress the "change" emit. */
let resetting = false;

const fontTheme = EditorView.theme({
  ".cm-content, .cm-gutters": { fontFamily: "var(--font-mono)", fontSize: "14px" },
  ".cm-lineNumbers .cm-gutterElement": { fontFamily: "var(--font-mono)", fontSize: "14px" },
});

const lightTheme = EditorView.theme(
  {
    "&": { background: "transparent", color: "var(--foreground)" },
    ".cm-content": { caretColor: "var(--foreground)" },
    ".cm-cursor": { borderLeftColor: "var(--foreground)" },
    ".cm-gutters": { background: "transparent", borderRight: "1px solid var(--border)", color: "var(--muted-foreground)" },
    ".cm-activeLineGutter": { background: "var(--muted)" },
    ".cm-activeLine": { background: "color-mix(in srgb, var(--muted) 40%, transparent)" },
    ".cm-selectionBackground, ::selection": { background: "var(--accent) !important" },
  },
  { dark: false },
);

function buildThemeExtension(dark: boolean) {
  return dark
    ? [oneDark]
    : [lightTheme, syntaxHighlighting(defaultHighlightStyle, { fallback: true })];
}

function buildLanguageExtension(filePath: string) {
  const lang = detectLanguage(filePath);
  return lang ? [lang] : [];
}

function createState(content: string): EditorState {
  const dark = colorMode.value === "dark";
  return EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      search({ top: true }),
      keymap.of([
        { key: "Mod-s", run: () => { handleSave(); return true; } },
        indentWithTab,
        ...searchKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
      ]),
      codemirrorInlineAnnotationExtension(),
      fontTheme,
      themeCompartment.of(buildThemeExtension(dark)),
      languageCompartment.of(buildLanguageExtension(props.filePath)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !resetting) {
          emit("change", update.state.doc.toString() !== props.content);
        }
      }),
      EditorView.theme({
        "&": { height: "100%" },
        ".cm-scroller": {
          overflow: "auto",
          scrollbarWidth: "thin",
          fontFamily: "var(--font-mono)",
          fontSize: "14px",
        },
      }),
    ],
  });
}

function handleSave() {
  if (!view) return;
  emit("save", props.filePath, view.state.doc.toString());
}

function mountEditor() {
  const container = containerRef.value;
  if (!container || view) return;
  view = new EditorView({
    state: createState(props.content),
    parent: container,
  });
  const target = props.scrollTop ?? 0;
  if (target > 0) {
    requestAnimationFrame(() => {
      if (view) view.scrollDOM.scrollTop = target;
    });
  }
}

function resetDocument(newContent: string, newFilePath: string) {
  if (!view) return;
  resetting = true;
  try {
    // Replace document content and reconfigure language — does NOT discard base extensions.
    // scrollIntoView is intentionally omitted: CM's internal layout pass fires after our RAF
    // and would override the restored scroll position.
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newContent },
      selection: { anchor: 0 },
      effects: [
        clearAnnotationsEffect.of(null),
        languageCompartment.reconfigure(buildLanguageExtension(newFilePath)),
      ],
    });
  } finally {
    resetting = false;
  }
  requestAnimationFrame(() => {
    if (view) view.scrollDOM.scrollTop = props.scrollTop ?? 0;
  });
}

onMounted(() => {
  mountEditor();
});

// Single watcher covering both filePath and content changes.
// When filePath changes the language reconfigures immediately;
// when content arrives from the query it resets the document.
watch(
  [() => props.filePath, () => props.content],
  ([newPath, newContent]) => {
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc === newContent) {
      // Content is the same — only reconfigure language if path changed.
      view.dispatch({
        effects: languageCompartment.reconfigure(buildLanguageExtension(newPath)),
      });
    } else {
      resetDocument(newContent, newPath);
    }
  },
);

watch(() => props.scrollTop, (top) => {
  if (top === undefined || !view) return;
  requestAnimationFrame(() => {
    if (view) view.scrollDOM.scrollTop = top;
  });
});

watch(colorMode, (mode) => {
  if (!view) return;
  view.dispatch({
    effects: themeCompartment.reconfigure(buildThemeExtension(mode === "dark")),
  });
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

defineExpose({
  triggerSave: () => handleSave(),
  getScrollTop: () => view?.scrollDOM.scrollTop ?? 0,
  openSearch: () => { if (view) openSearchPanel(view); },
});
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div
      ref="containerRef"
      class="code-mirror-editor min-h-0 flex-1"
    />
  </div>
</template>

<style>
.code-mirror-editor {
  contain: strict;
}

.code-mirror-editor .cm-editor {
  height: 100%;
}

.code-mirror-editor .cm-editor.cm-focused {
  outline: none;
}

.dark .code-mirror-editor .cm-editor,
.dark .code-mirror-editor .cm-scroller {
  background: var(--background) !important;
}

.dark .code-mirror-editor .cm-gutters {
  background: var(--background) !important;
  border-right-color: var(--border) !important;
}

/* Search panel */
.code-mirror-editor .cm-panels-top {
  border-bottom: 1px solid var(--border) !important;
}

.code-mirror-editor .cm-panels-bottom {
  border-top: 1px solid var(--border) !important;
}

.code-mirror-editor .cm-panels {
  background: var(--background) !important;
  color: var(--foreground) !important;
}

/* Two-row flex layout; <br> elements act as row breaks */
.code-mirror-editor .cm-search {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 5px 32px 5px 8px; /* right padding reserves space for close button */
}

/* Force each <br> to become a full-width row separator */
.code-mirror-editor .cm-search br {
  flex-basis: 100%;
  height: 0;
  margin: 0;
  padding: 0;
}

/* Text inputs */
.code-mirror-editor .cm-search .cm-textfield,
.code-mirror-editor .cm-textfield {
  height: 24px;
  min-width: 160px;
  padding: 0 8px;
  font-size: 12px;
  font-family: inherit;
  background: var(--background) !important;
  color: var(--foreground) !important;
  border: 1px solid var(--border) !important;
  border-radius: calc(var(--radius) - 2px) !important;
  outline: none !important;
  box-shadow: none !important;
  transition: border-color 0.15s;
}

.code-mirror-editor .cm-search .cm-textfield:focus,
.code-mirror-editor .cm-textfield:focus {
  border-color: var(--ring) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 20%, transparent) !important;
}

/* Action buttons */
.code-mirror-editor .cm-search button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  line-height: 1;
  background: transparent;
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, color 0.15s;
}

.code-mirror-editor .cm-search button:hover {
  background: var(--accent);
  color: var(--accent-foreground);
}

.code-mirror-editor .cm-search button:active {
  background: color-mix(in srgb, var(--accent) 80%, var(--foreground) 10%);
}

/* Close button — pinned to top-right of the panel */
.code-mirror-editor .cm-search button[name="close"] {
  position: absolute;
  top: 5px;
  right: 6px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  border-radius: calc(var(--radius) - 2px);
}

.code-mirror-editor .cm-search button[name="close"]:hover {
  background: var(--accent);
  color: var(--foreground);
}

/* Checkbox labels */
.code-mirror-editor .cm-search label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-family: inherit;
  color: var(--muted-foreground);
  cursor: pointer;
  user-select: none;
}

.code-mirror-editor .cm-search label:hover {
  color: var(--foreground);
}

/* Checkboxes */
.code-mirror-editor .cm-search input[type="checkbox"] {
  width: 13px;
  height: 13px;
  accent-color: var(--foreground);
  cursor: pointer;
}

/* Match highlights */
.cm-searchMatch {
  background-color: color-mix(in srgb, var(--accent) 60%, transparent) !important;
  outline: 1px solid var(--border) !important;
}

.cm-searchMatch-selected {
  background-color: color-mix(in srgb, var(--ring) 40%, transparent) !important;
  outline: 1px solid var(--ring) !important;
}
</style>
