import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import type { LanguageSupport } from "@codemirror/language";

export function detectLanguage(filePath: string): LanguageSupport | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return javascript({ typescript: true, jsx: ext === "tsx" });
    case "js":
    case "jsx":
      return javascript({ jsx: ext === "jsx" });
    case "py":
      return python();
    case "json":
      return json();
    case "css":
      return css();
    case "html":
      return html();
    case "md":
    case "mdx":
      return markdown();
    default:
      return null;
  }
}
