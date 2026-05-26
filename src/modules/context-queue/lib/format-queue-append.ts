export function formatQueueAppend({
  relativePath,
  selection,
}: {
  relativePath: string;
  selection?: string;
}): string {
  const path = relativePath.trim();
  const body = selection?.trim();
  let block = `# ${path}\n`;
  if (body) block += `${body}\n`;
  return `${block}\n`;
}
