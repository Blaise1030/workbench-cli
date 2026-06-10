import { nextTick, onBeforeUnmount, watch, type MaybeRefOrGetter, toValue } from "vue";

interface ScrollActiveTabIntoViewOptions {
  /** The horizontally-scrolling tab strip container. */
  container: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /** Identifier of the active tab (e.g. file path or terminal id). */
  activeKey: MaybeRefOrGetter<string | null | undefined>;
  /** `data-*` attribute on each tab element that holds its key. */
  attribute: string;
  /**
   * Anything reactive that changes when the set of tabs changes (so a newly
   * appended active tab gets scrolled into view). Optional.
   */
  tabsKey?: MaybeRefOrGetter<unknown>;
  /**
   * Width in px of a sticky overlay covering the right edge (e.g. a gradient
   * fade) that the active tab must stay clear of. Defaults to 0.
   */
  fadeOverlayPx?: number;
}

/**
 * Keeps the active tab scrolled into view within a horizontally-scrolling tab
 * strip. Scrolls on active-tab change, tab-set change, initial mount, and
 * whenever the strip resizes (e.g. a side panel collapsing/expanding).
 *
 * Uses viewport-relative rects + `scrollBy` so the math is immune to
 * offsetParent / CSS-transform quirks from resizable split panels, and only
 * ever scrolls the strip itself — never the page.
 */
export function useScrollActiveTabIntoView(options: ScrollActiveTabIntoViewOptions) {
  const { attribute, fadeOverlayPx = 0 } = options;

  function scrollIntoView() {
    const container = toValue(options.container);
    const activeKey = toValue(options.activeKey);
    if (!container || !activeKey) return;

    const el = container.querySelector<HTMLElement>(
      `[${attribute}="${CSS.escape(activeKey)}"]`,
    );
    // Strip not laid out yet (e.g. mid-refresh, before the panel has width).
    if (!el || container.clientWidth === 0) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = el.getBoundingClientRect();
    const leftOverflow = tabRect.left - containerRect.left;
    const rightOverflow = tabRect.right - (containerRect.right - fadeOverlayPx);

    if (leftOverflow < 0) {
      container.scrollBy({ left: leftOverflow - 8 });
    } else if (rightOverflow > 0) {
      container.scrollBy({ left: rightOverflow + 8 });
    }
  }

  // Wait for the Vue render (nextTick) and the browser layout/paint (rAF)
  // before measuring — needed on refresh when tabs and panel sizing land in
  // the same frame.
  async function scrollIntoViewDeferred() {
    await nextTick();
    requestAnimationFrame(scrollIntoView);
  }

  watch(
    [() => toValue(options.activeKey), () => toValue(options.tabsKey)],
    scrollIntoViewDeferred,
    { flush: "post", immediate: true },
  );

  // Re-observe whenever the container element itself changes (the ref populates
  // after mount, and some layouts swap between containers). The out-of-view
  // check in scrollIntoView makes resize-triggered calls a no-op when the
  // active tab is already visible.
  let resizeObserver: ResizeObserver | null = null;
  watch(
    () => toValue(options.container),
    (container) => {
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (!container || typeof ResizeObserver === "undefined") return;
      resizeObserver = new ResizeObserver(() => scrollIntoView());
      resizeObserver.observe(container);
      scrollIntoViewDeferred();
    },
    { immediate: true, flush: "post" },
  );

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
  });

  return { scrollActiveTabIntoView: scrollIntoView };
}
