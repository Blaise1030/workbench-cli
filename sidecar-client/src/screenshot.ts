import html2canvas from "html2canvas";

export async function captureScreenshot(el: HTMLElement): Promise<string> {
  const rect = el.getBoundingClientRect();
  const canvas = await html2canvas(document.body, {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
    useCORS: true,
    logging: false,
  });
  // Remove the "data:image/png;base64," prefix — Go decodes raw base64
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}
