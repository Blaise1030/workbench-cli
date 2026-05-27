import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import type { SelectedLineRange } from "@pierre/diffs";
import {
  createContextQueueAnnotationElement,
  type AnnotationCallbacks,
} from "@/modules/context-queue/lib/context-queue-annotation-popover";
import type { ContextQueueAnnotationMeta } from "@/modules/context-queue/lib/context-queue-annotation-types";
import type { StoredContextQueueAnnotation } from "@/modules/context-queue/lib/context-queue-annotations-state";
import type { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";

type AnnotationEntry = {
  id: string;
  pos: number;
  annotation: StoredContextQueueAnnotation;
  callbacks: AnnotationCallbacks;
};

export const addAnnotationEffect = StateEffect.define<AnnotationEntry>();
export const removeAnnotationEffect = StateEffect.define<string>();
export const clearAnnotationsEffect = StateEffect.define<null>();

class InlineAnnotationWidget extends WidgetType {
  constructor(private readonly entry: AnnotationEntry) {
    super();
  }

  toDOM(): HTMLElement {
    const container = document.createElement("div");
    container.className = "cm-context-annotation-widget";
    container.style.cssText = "padding: 4px 8px;";
    container.appendChild(
      createContextQueueAnnotationElement(this.entry.annotation, this.entry.callbacks),
    );
    return container;
  }

  eq(other: InlineAnnotationWidget): boolean {
    return this.entry.id === other.entry.id;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const annotationField = StateField.define<Map<string, AnnotationEntry>>({
  create: () => new Map(),
  update(value, tr) {
    if (!tr.effects.length) return value;
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(clearAnnotationsEffect)) {
        return new Map();
      }
      if (effect.is(addAnnotationEffect)) {
        next = new Map(next);
        next.set(effect.value.id, effect.value);
      } else if (effect.is(removeAnnotationEffect)) {
        if (next.has(effect.value)) {
          next = new Map(next);
          next.delete(effect.value);
        }
      }
    }
    return next;
  },
  provide(field) {
    return EditorView.decorations.from(field, (entries, state): DecorationSet => {
      if (!entries.size) return Decoration.none;
      const sorted = [...entries.values()].sort((a, b) => a.pos - b.pos);
      const widgets = sorted
        .filter((entry) => entry.pos <= state.doc.length)
        .map((entry) =>
          Decoration.widget({ widget: new InlineAnnotationWidget(entry), block: true, side: 1 }).range(
            entry.pos,
          ),
        );
      if (!widgets.length) return Decoration.none;
      return Decoration.set(widgets);
    });
  },
});

export function codemirrorInlineAnnotationExtension(): Extension {
  return annotationField;
}

export function addCodeMirrorAnnotationToView(
  view: EditorView,
  ctx: { relativePath: string; lineRange: SelectedLineRange; selection: string },
  queue: ReturnType<typeof useContextQueue>,
): void {
  const meta: ContextQueueAnnotationMeta = {
    id: crypto.randomUUID(),
    itemId: ctx.relativePath,
    relativePath: ctx.relativePath,
    range: ctx.lineRange,
    selection: ctx.selection,
    note: "",
    includeSnippet: false,
    diff: false,
    expanded: true,
  };

  const annotation: StoredContextQueueAnnotation = {
    lineNumber: ctx.lineRange.end,
    metadata: meta,
  };

  const callbacks: AnnotationCallbacks = {
    onNoteChange(_id, note) {
      meta.note = note;
    },
    onIncludeSnippetChange(_id, include) {
      meta.includeSnippet = include;
    },
    onQueue(payload) {
      queue.appendFromContext({
        relativePath: payload.relativePath,
        lineRange: payload.range,
        diff: payload.diff,
        note: payload.note,
        selection: payload.selection,
        includeSnippet: payload.includeSnippet,
      });
      view.dispatch({ effects: removeAnnotationEffect.of(payload.id) });
      queue.openPopover();
    },
    onRemove(id) {
      view.dispatch({ effects: removeAnnotationEffect.of(id) });
    },
    onExpand(_id) {
      meta.expanded = true;
    },
    onCollapse(_id) {
      meta.expanded = false;
    },
  };

  const lineCount = view.state.doc.lines;
  const lineNum = Math.min(Math.max(1, ctx.lineRange.end), lineCount);
  const pos = view.state.doc.line(lineNum).to;

  view.dispatch({
    effects: addAnnotationEffect.of({ id: meta.id, pos, annotation, callbacks }),
  });
}
