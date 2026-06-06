import { onINP, onLCP, onCLS, type MetricWithAttribution } from "web-vitals/attribution";

// Thresholds matching Google's "good" boundaries
const THRESHOLDS = {
  INP: 200,  // ms — good ≤200, needs improvement ≤500, poor >500
  LCP: 2500, // ms — good ≤2500
  CLS: 0.1,  // score — good ≤0.1
};

function rating(metric: MetricWithAttribution): "good" | "needs-improvement" | "poor" {
  return metric.rating as "good" | "needs-improvement" | "poor";
}

function report(metric: MetricWithAttribution) {
  const r = rating(metric);
  const label = `[perf] ${metric.name}`;
  const value = metric.name === "CLS" ? metric.value.toFixed(4) : `${Math.round(metric.value)}ms`;

  if (r === "poor") {
    console.warn(`${label} POOR: ${value}`);
  } else if (r === "needs-improvement") {
    console.info(`${label} needs improvement: ${value}`);
  } else {
    console.debug(`${label} good: ${value}`);
  }

  // PostHog — tree-shake if posthog-js is not installed
  if (typeof window !== "undefined" && "__posthog__" in window) {
    const ph = (window as Record<string, unknown>)["__posthog__"] as {
      capture: (event: string, props: Record<string, unknown>) => void;
    };
    ph.capture("web_vital", {
      metric: metric.name,
      value: metric.value,
      rating: r,
      // INP: which element was interacted with
      ...("interactionTarget" in (metric as MetricWithAttribution).attribution
        ? { element: (metric as MetricWithAttribution).attribution.interactionTarget }
        : {}),
    });
  }
}

export function initPerfVitals() {
  onINP(report, { reportAllChanges: false });
  onLCP(report);
  onCLS(report);
}
