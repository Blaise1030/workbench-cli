<script setup lang="ts">
import {
  CodeView,
  type CodeViewItem,
  type DiffIndicators,
  type FileDiffMetadata,
} from "@pierre/diffs";
import { useDebounceFn, useMutationObserver } from "@vueuse/core";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import { explorerFileRoute } from "@/modules/file-explorer/lib/explorer-file-route";
import { useAppColorMode } from "@/shared/hooks/useAppColorMode";
import {
  getPierreWorkerPool,
  PIERRE_DIFF_THEME,
  whenPierreWorkerReady,
} from "@/shared/lib/pierre-diff-worker-pool";
import gitDiffHeaderStyles from "@/modules/git/components/git-diff-header.css?inline";

const DIFFS_HOST_TAG = "diffs-container";
const EXPLORER_LINK_SELECTOR = "a.git-diff-explorer-link";

/** Tailwind classes on the collapse control (also defined in git-diff-header.css). */
const HEADER_PREFIX_CLASS =
  "git-diff-header-prefix inline-flex shrink-0 flex-nowrap items-center gap-2";
const SELECT_CHECKBOX_HOST_CLASS = "git-diff-select-checkbox-host";
const SELECT_CHECKBOX_CLASS = "git-diff-select-checkbox";
const COLLAPSE_BTN_CLASS =
  "git-diff-collapse-btn inline-flex size-6 shrink-0 items-center justify-center rounded-[min(var(--radius-md),10px)] border border-transparent bg-transparent text-muted-foreground outline-none transition-all select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-expanded:text-foreground dark:hover:bg-muted/50";
const COLLAPSE_ICON_CLASS = "git-diff-collapse-icon size-3 shrink-0 pointer-events-none";

const props = defineProps<{
  items: CodeViewItem[];
  worktreeId: string;
  worktreePath?: string;
  collapsedIds?: string[];
  disableBackground?: boolean;
  disableLineNumbers?: boolean;
  wordWrap?: boolean;
  diffIndicators?: DiffIndicators;
  diffStyle?: "unified" | "split";
  allCollapsed?: boolean;
  selectedPaths?: string[];
  /** True when this pane's git tab is selected (re-syncs header checkboxes on activate). */
  tabActive?: boolean;
}>();

const router = useRouter();

const selectedPathSet = computed(
  () => new Set(props.selectedPaths ?? []),
);

const emit = defineEmits<{
  "update:collapsedIds": [ids: string[]];
  "update:selectedPaths": [paths: string[]];
  /** Expand a single diff while the collapse-all toolbar mode is active. */
  "expand-one": [itemId: string];
}>();

/** Local collapse state applied before parent props round-trip. */
const optimisticCollapsedIds = ref<string[] | null>(null);
const optimisticAllCollapsed = ref<boolean | null>(null);
/** Pierre only reapplies collapse when item.version changes. */
const collapseVersionById = ref<Record<string, number>>({});

const rootRef = ref<HTMLElement | null>(null);
const viewer = shallowRef<CodeView | null>(null);
const { colorMode } = useAppColorMode();
const optionsVersion = ref(0);

const themeType = computed(() =>
  colorMode.value === "dark" ? ("dark" as const) : ("light" as const),
);

const CHEVRON_PATH_COLLAPSED = "m9 18 6-6-6-6";
const CHEVRON_PATH_EXPANDED = "m6 9 6 6 6-6";

function resolvedAllCollapsed(): boolean {
  if (optimisticAllCollapsed.value !== null) {
    return optimisticAllCollapsed.value;
  }
  return props.allCollapsed === true;
}

function resolvedCollapsedIds(): string[] {
  return optimisticCollapsedIds.value ?? props.collapsedIds ?? [];
}

function resolvedCollapsedIdSet(): Set<string> {
  return new Set(resolvedCollapsedIds());
}

function isItemCollapsed(itemId: string): boolean {
  if (resolvedAllCollapsed()) return true;
  return resolvedCollapsedIdSet().has(itemId);
}

function wasItemCollapsed(
  itemId: string,
  allCollapsed: boolean | undefined,
  collapsedIds: string[] | undefined,
): boolean {
  if (allCollapsed === true) return true;
  return new Set(collapsedIds ?? []).has(itemId);
}

/** Item ids whose collapsed state changed (for targeted CodeView version bumps). */
function itemIdsWithCollapsedChange(
  prevCollapsedIds: string[] | undefined,
  prevAllCollapsed: boolean | undefined,
): string[] {
  const nextAll = resolvedAllCollapsed();
  const prevAll = prevAllCollapsed === true;
  if (prevAll !== nextAll) {
    return props.items.map((item) => item.id);
  }

  const nextSet = resolvedCollapsedIdSet();
  const changed: string[] = [];
  for (const item of props.items) {
    const was = wasItemCollapsed(item.id, prevAllCollapsed, prevCollapsedIds);
    const now = nextAll || nextSet.has(item.id);
    if (was !== now) changed.push(item.id);
  }
  return changed;
}

function bumpCollapseVersions(itemIds: string[]) {
  if (!itemIds.length) return;
  const next = { ...collapseVersionById.value };
  for (const id of itemIds) {
    next[id] = (next[id] ?? 0) + 1;
  }
  collapseVersionById.value = next;
}

function itemVersionForView(item: CodeViewItem): number | undefined {
  const bump = collapseVersionById.value[item.id];
  if (bump == null) return item.version;
  return (item.version ?? 0) + bump;
}

function clearOptimisticCollapseState() {
  optimisticCollapsedIds.value = null;
  optimisticAllCollapsed.value = null;
}

function collapsedIdsEqual(a: string[] | undefined, b: string[]): boolean {
  const left = a ?? [];
  if (left.length !== b.length) return false;
  const right = new Set(b);
  return left.every((id) => right.has(id));
}

function reconcileOptimisticCollapseState(
  collapsedIds: string[] | undefined,
  allCollapsed: boolean | undefined,
): boolean {
  const optIds = optimisticCollapsedIds.value;
  const optAll = optimisticAllCollapsed.value;

  if (optIds !== null) {
    const allMatches = optAll === null || allCollapsed === optAll;
    if (!collapsedIdsEqual(collapsedIds, optIds) || !allMatches) {
      return false;
    }
    clearOptimisticCollapseState();
    return true;
  }

  if (optAll !== null) {
    if (allCollapsed !== optAll) return false;
    clearOptimisticCollapseState();
    return true;
  }

  return true;
}

function findCollapseButton(itemId: string): HTMLButtonElement | null {
  const root = rootRef.value;
  if (!root) return null;

  const selector = `.git-diff-collapse-btn[data-git-diff-item-id="${CSS.escape(itemId)}"]`;
  const fromRoot = root.querySelector<HTMLButtonElement>(selector);
  if (fromRoot) return fromRoot;

  for (const host of root.querySelectorAll(DIFFS_HOST_TAG)) {
    if (!(host instanceof HTMLElement) || !host.shadowRoot) continue;
    const fromShadow = host.shadowRoot.querySelector<HTMLButtonElement>(selector);
    if (fromShadow) return fromShadow;
  }
  return null;
}

function updateCollapseButtonForItem(itemId: string, collapsed: boolean) {
  const button = findCollapseButton(itemId);
  if (button) setCollapseButtonState(button, collapsed);
}

function toggleItemCollapsed(itemId: string) {
  if (resolvedAllCollapsed()) {
    optimisticAllCollapsed.value = false;
    optimisticCollapsedIds.value = props.items
      .map((item) => item.id)
      .filter((id) => id !== itemId);
    applyViewerItems(props.items.map((item) => item.id));
    emit("expand-one", itemId);
    return;
  }

  const nextIds = new Set(resolvedCollapsedIds());
  if (nextIds.has(itemId)) nextIds.delete(itemId);
  else nextIds.add(itemId);
  optimisticCollapsedIds.value = [...nextIds];
  applyViewerItems([itemId]);
  emit("update:collapsedIds", optimisticCollapsedIds.value);
}

function isPathSelected(filePath: string | undefined): boolean {
  if (!filePath) return false;
  return selectedPathSet.value.has(filePath);
}

function setPathSelected(filePath: string, checked: boolean) {
  const next = new Set(selectedPathSet.value);
  if (checked) next.add(filePath);
  else next.delete(filePath);
  emit("update:selectedPaths", [...next]);
}

function forEachDiffContainer(run: (container: ParentNode) => void) {
  const root = rootRef.value;
  if (!root) return;
  run(root);
  for (const host of root.querySelectorAll(DIFFS_HOST_TAG)) {
    if (host instanceof HTMLElement && host.shadowRoot) {
      run(host.shadowRoot);
    }
  }
}

function syncCheckboxInputsFromDom() {
  const selected = selectedPathSet.value;
  forEachDiffContainer((container) => {
    container
      .querySelectorAll<HTMLInputElement>(`input.${SELECT_CHECKBOX_CLASS}`)
      .forEach((input) => {
        const filePath = input.dataset.gitDiffFilePath;
        if (!filePath) return;
        const checked = selected.has(filePath);
        if (input.checked !== checked) input.checked = checked;
      });
  });
}

const scheduleSyncCheckboxInputs = useDebounceFn(() => {
  requestAnimationFrame(syncCheckboxInputsFromDom);
}, 32);

function createSelectCheckbox(filePath: string | undefined): HTMLElement {
  const host = document.createElement("div");
  host.className = SELECT_CHECKBOX_HOST_CLASS;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = SELECT_CHECKBOX_CLASS;
  input.disabled = !filePath;
  if (filePath) {
    input.dataset.gitDiffFilePath = filePath;
    input.checked = isPathSelected(filePath);
  }
  input.setAttribute(
    "aria-label",
    filePath ? `Select ${filePath}` : "Select file",
  );

  host.append(input);
  return host;
}

function createChevronIcon(collapsed: boolean): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", COLLAPSE_ICON_CLASS);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    collapsed ? CHEVRON_PATH_COLLAPSED : CHEVRON_PATH_EXPANDED,
  );
  svg.append(path);
  return svg;
}

function setCollapseButtonState(button: HTMLButtonElement, collapsed: boolean) {
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute(
    "aria-label",
    collapsed ? "Expand diff" : "Collapse diff",
  );
  const path = button.querySelector<SVGPathElement>(
    ".git-diff-collapse-icon path",
  );
  path?.setAttribute(
    "d",
    collapsed ? CHEVRON_PATH_COLLAPSED : CHEVRON_PATH_EXPANDED,
  );
}

function syncCollapseButtons() {
  const root = rootRef.value;
  if (!root) return;

  const updateIn = (container: ParentNode) => {
    container
      .querySelectorAll<HTMLButtonElement>(".git-diff-collapse-btn")
      .forEach((button) => {
        const itemId = button.dataset.gitDiffItemId;
        if (!itemId) return;
        setCollapseButtonState(button, isItemCollapsed(itemId));
      });
  };

  updateIn(root);
  root.querySelectorAll(DIFFS_HOST_TAG).forEach((host) => {
    if (host instanceof HTMLElement && host.shadowRoot) {
      updateIn(host.shadowRoot);
    }
  });
}

const scheduleSyncCollapseButtons = useDebounceFn(() => {
  requestAnimationFrame(syncCollapseButtons);
}, 32);

function createHeaderPrefix(
  itemId: string,
  filePath: string | undefined,
): HTMLElement {
  const prefix = document.createElement("div");
  prefix.className = HEADER_PREFIX_CLASS;
  prefix.append(createSelectCheckbox(filePath), createCollapseButton(itemId));
  return prefix;
}

function createCollapseButton(itemId: string): HTMLButtonElement {
  const collapsed = isItemCollapsed(itemId);
  const button = document.createElement("button");
  button.type = "button";
  button.className = COLLAPSE_BTN_CLASS;
  button.dataset.gitDiffCollapse = "";
  button.dataset.gitDiffItemId = itemId;
  setCollapseButtonState(button, collapsed);
  button.append(createChevronIcon(collapsed));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    toggleItemCollapsed(itemId);
  });
  return button;
}

function relativePathForTitle(
  fileDiff: FileDiffMetadata | undefined,
  titleIndex: number,
  titleCount: number,
  fallbackText: string,
): string | null {
  if (fileDiff) {
    if (fileDiff.prevName != null && titleCount > 1) {
      return titleIndex === 0 ? fileDiff.prevName : fileDiff.name;
    }
    return fileDiff.name;
  }
  const trimmed = fallbackText.trim();
  return trimmed || null;
}

function createExplorerLinkIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "git-diff-explorer-link-icon size-3 shrink-0 opacity-55");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const pathA = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathA.setAttribute(
    "d",
    "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
  );
  const pathB = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathB.setAttribute(
    "d",
    "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  );
  svg.append(pathA, pathB);
  return svg;
}

function createExplorerLink(relativePath: string): HTMLAnchorElement {
  const worktreePath = props.worktreePath;
  if (!worktreePath) {
    throw new Error("worktreePath is required to build explorer links");
  }

  const to = explorerFileRoute(props.worktreeId, worktreePath, relativePath);
  const link = document.createElement("a");
  link.className =
    "git-diff-explorer-link inline-flex max-w-full items-center gap-1 text-inherit no-underline hover:underline";
  link.href = router.resolve(to).href;
  link.title = `Open ${relativePath} in file explorer`;

  const label = document.createElement("span");
  label.className = "git-diff-explorer-link-label min-w-0 truncate";
  label.textContent = relativePath;

  link.append(label, createExplorerLinkIcon());
  link.addEventListener("click", (event) => {
    event.stopPropagation();
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    router.push(to);
  });
  return link;
}

function enhanceHeaderLinksInHost(
  host: HTMLElement,
  fileDiff?: FileDiffMetadata,
) {
  if (!props.worktreePath) return;

  const shadow = host.shadowRoot;
  if (!shadow) return;

  const titles = [...shadow.querySelectorAll<HTMLElement>("[data-title] bdi")];
  titles.forEach((bdi, index) => {
    if (bdi.querySelector(EXPLORER_LINK_SELECTOR)) return;

    const relativePath = relativePathForTitle(
      fileDiff,
      index,
      titles.length,
      bdi.textContent ?? "",
    );
    if (!relativePath) return;

    bdi.replaceChildren(createExplorerLink(relativePath));
  });
}

function enhanceAllHeaderLinks() {
  const root = rootRef.value;
  if (!root || !props.worktreePath) return;

  root.querySelectorAll(DIFFS_HOST_TAG).forEach((host) => {
    if (host instanceof HTMLElement) {
      enhanceHeaderLinksInHost(host);
    }
  });
}

const scheduleEnhanceAllHeaderLinks = useDebounceFn(() => {
  requestAnimationFrame(() => enhanceAllHeaderLinks());
}, 32);

function diffOptions() {
  return {
    theme: PIERRE_DIFF_THEME,
    themeType: themeType.value,
    disableBackground: props.disableBackground,
    disableLineNumbers: props.disableLineNumbers,
    overflow: props.wordWrap ? ("wrap" as const) : ("scroll" as const),
    diffIndicators: props.diffIndicators,
    diffStyle: props.diffStyle ?? "unified",
    unsafeCSS: gitDiffHeaderStyles,
    renderHeaderPrefix: (
      fileDiff: FileDiffMetadata,
      context: { type: string; item: CodeViewItem },
    ) => {
      if (context.type !== "diff" || context.item.type !== "diff") return undefined;
      const filePath =
        fileDiff.name ??
        ("filePath" in context.item
          ? (context.item.filePath as string | undefined)
          : undefined);
      return createHeaderPrefix(context.item.id, filePath);
    },
    onPostRender: (
      host: HTMLElement,
      _instance: unknown,
      context: { type: string; item: CodeViewItem },
    ) => {
      if (context.type !== "diff" || context.item.type !== "diff") return;
      enhanceHeaderLinksInHost(host, context.item.fileDiff);
    },
  };
}

function itemsForView() {
  const allCollapsed = resolvedAllCollapsed();
  const collapsedIds = resolvedCollapsedIdSet();
  return props.items.map((item) => ({
    ...item,
    collapsed: allCollapsed || collapsedIds.has(item.id),
    version: itemVersionForView(item),
  }));
}

/** Full refresh when diff items change (rebuilds list + header slots). */
function applyViewerItems(changedItemIds?: string[]) {
  if (!viewer.value) return;
  bumpCollapseVersions(changedItemIds ?? props.items.map((item) => item.id));
  viewer.value.setItems(itemsForView());
  scheduleSyncCollapseButtons();
  scheduleSyncCheckboxInputs();
  scheduleEnhanceAllHeaderLinks();
}

/** Collapse-only updates — bump version only for affected items (Pierre CodeView pattern). */
function applyCollapseUpdates(changedItemIds: string[]) {
  if (!viewer.value || changedItemIds.length === 0) return;
  bumpCollapseVersions(changedItemIds);
  viewer.value.setItems(itemsForView());
  scheduleSyncCollapseButtons();
}

async function mountViewer() {
  const root = rootRef.value;
  if (!root || viewer.value) return;

  await whenPierreWorkerReady();

  const instance = new CodeView(
    {
      ...diffOptions(),
      stickyHeaders: true,
      layout: { paddingTop: 8, paddingBottom: 8, gap: 8 },
    },
    getPierreWorkerPool(),
  );
  instance.setup(root);
  instance.setItems(itemsForView());
  viewer.value = instance;
  scheduleEnhanceAllHeaderLinks();
  scheduleSyncCheckboxInputs();
}

const persistCollapsedIds = useDebounceFn(() => {
  if (!viewer.value || props.allCollapsed !== undefined) return;
  const collapsed = props.items
    .map((item) => item.id)
    .filter((id) => viewer.value?.getItem(id)?.collapsed);
  emit("update:collapsedIds", collapsed);
}, 200);

function onRootPointerUp() {
  persistCollapsedIds();
}

function onRootCheckboxChange(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.classList.contains(SELECT_CHECKBOX_CLASS)) return;
  const filePath = target.dataset.gitDiffFilePath;
  if (!filePath) return;
  setPathSelected(filePath, target.checked);
}

function onRootClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target instanceof HTMLInputElement && target.classList.contains(SELECT_CHECKBOX_CLASS)) {
    event.stopPropagation();
    return;
  }
  if (
    target.closest(EXPLORER_LINK_SELECTOR) ||
    target.closest(".git-diff-collapse-btn") ||
    target.closest(`.${SELECT_CHECKBOX_HOST_CLASS}`)
  ) {
    return;
  }

  const header = target.closest("[data-diffs-header]");
  if (!header) return;

  const root = header.getRootNode();
  if (!(root instanceof ShadowRoot)) return;

  root.querySelector<HTMLButtonElement>(".git-diff-collapse-btn")?.click();
}

function syncOptions() {
  optionsVersion.value++;
  const v = optionsVersion.value;
  viewer.value?.setOptions(diffOptions());
  viewer.value?.setItems(
    itemsForView().map((item) => ({ ...item, version: v })),
  );
  scheduleEnhanceAllHeaderLinks();
  scheduleSyncCollapseButtons();
  scheduleSyncCheckboxInputs();
}

function syncTheme() {
  syncOptions();
}

onMounted(() => {
  void mountViewer();
  const root = rootRef.value;
  root?.addEventListener("pointerup", onRootPointerUp);
  root?.addEventListener("click", onRootClick);
  root?.addEventListener("change", onRootCheckboxChange);
});

watch(
  () => [props.items, props.collapsedIds, props.allCollapsed] as const,
  ([items, collapsedIds, allCollapsed], prev) => {
    const propsReady = reconcileOptimisticCollapseState(
      collapsedIds,
      allCollapsed,
    );
    if (!propsReady) return;

    const itemsChanged = items !== prev?.[0];
    const collapseChanged =
      allCollapsed !== prev?.[2] ||
      !collapsedIdsEqual(prev?.[1], collapsedIds ?? []);

    if (itemsChanged) {
      collapseVersionById.value = {};
    }

    if (viewer.value) {
      if (itemsChanged || !prev) {
        applyViewerItems();
      } else if (collapseChanged) {
        applyCollapseUpdates(
          itemIdsWithCollapsedChange(prev?.[1], prev?.[2]),
        );
      }
    } else {
      void mountViewer();
    }
  },
  { deep: true },
);

watch(themeType, () => {
  syncTheme();
});

watch(
  () => [
    props.disableBackground,
    props.disableLineNumbers,
    props.wordWrap,
    props.diffIndicators,
    props.diffStyle,
  ],
  () => syncOptions(),
);

watch(selectedPathSet, () => scheduleSyncCheckboxInputs());

watch(
  () => props.tabActive,
  (active) => {
    if (!active || !viewer.value) return;
    scheduleSyncCollapseButtons();
    scheduleSyncCheckboxInputs();
  },
);

useMutationObserver(
  rootRef,
  () => {
    if (!viewer.value && rootRef.value) void mountViewer();
  },
  { childList: true },
);

watch(
  () => props.worktreePath,
  () => scheduleEnhanceAllHeaderLinks(),
);

onBeforeUnmount(() => {
  const root = rootRef.value;
  root?.removeEventListener("pointerup", onRootPointerUp);
  root?.removeEventListener("click", onRootClick);
  root?.removeEventListener("change", onRootCheckboxChange);
  viewer.value?.cleanUp();
  viewer.value = null;
});
</script>

<template>
  <div
    ref="rootRef"
    class="git-diff-code-view min-h-0 flex-1 overflow-auto"
  />
</template>

<style>
@import "tailwindcss";
@source "./git-diff-header.css";

.git-diff-code-view {
  contain: layout style;
}
</style>
