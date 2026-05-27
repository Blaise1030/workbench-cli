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
      keymap.of([
        { key: "Mod-s", run: () => { handleSave(); return true; } },
        indentWithTab,
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
}

function resetDocument(newContent: string, newFilePath: string) {
  if (!view) return;
  resetting = true;
  try {
    // Replace document content and reconfigure language — does NOT discard base extensions.
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newContent },
      selection: { anchor: 0 },
      effects: [
        clearAnnotationsEffect.of(null),
        languageCompartment.reconfigure(buildLanguageExtension(newFilePath)),
      ],
      scrollIntoView: true,
    });
  } finally {
    resetting = false;
  }
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

defineExpose({ triggerSave: () => handleSave() });
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
</style>
