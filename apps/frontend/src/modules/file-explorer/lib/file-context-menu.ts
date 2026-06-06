import van from "vanjs-core";
import { cn } from "@/lib/utils";
import type {
  FileTreeContextMenuItem,
  FileTreeContextMenuOpenContext,
} from "@pierre/trees";

const { div, button, hr } = van.tags;

export type FileContextMenuActions = {
  onCopyName: (name: string) => void;
  onNewFile: (parentPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onRename: (path: string) => void;
  onDelete: (paths: string[], isDir: boolean) => void;
};

function menuItem(label: string, danger: boolean, onClick: () => void): HTMLElement {
  return button(
    {
      type: "button",
      class: cn(
        "flex w-full items-center rounded px-2 py-1.5 text-left text-sm cursor-default",
        "focus:outline-none",
        danger
          ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
          : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      ),
      onclick: onClick,
    },
    label,
  );
}

function separator(): HTMLElement {
  return hr({ class: "my-1 border-border" });
}

function parentPath(item: FileTreeContextMenuItem): string {
  if (item.kind === "directory") return item.path;
  const slash = item.path.lastIndexOf("/");
  return slash >= 0 ? item.path.slice(0, slash) : "";
}

export function createFileContextMenu(
  item: FileTreeContextMenuItem,
  context: FileTreeContextMenuOpenContext,
  actions: FileContextMenuActions,
  selectedPaths: readonly string[],
): HTMLElement {
  const isMultiSelect = selectedPaths.length > 1 && selectedPaths.includes(item.path);
  const copyLabel = item.kind === "directory" ? "Copy folder name" : "Copy filename";
  const deleteLabel = isMultiSelect ? `Delete ${selectedPaths.length} items` : "Delete";
  const parent = parentPath(item);

  const items: HTMLElement[] = [
    menuItem(copyLabel, false, () => {
      actions.onCopyName(item.name);
      context.close();
    }),
    menuItem("Rename", false, () => {
      context.close({ restoreFocus: false });
      actions.onRename(item.path);
    }),
  ];

  if (item.kind === "directory") {
    items.push(
      separator(),
      menuItem("New File", false, () => {
        context.close({ restoreFocus: false });
        actions.onNewFile(parent);
      }),
      menuItem("New Folder", false, () => {
        context.close({ restoreFocus: false });
        actions.onNewFolder(parent);
      }),
    );
  }

  items.push(
    separator(),
    menuItem(deleteLabel, true, () => {
      context.close({ restoreFocus: false });
      const paths = isMultiSelect ? [...selectedPaths] : [item.path];
      actions.onDelete(paths, item.kind === "directory");
    }),
  );

  return div(
    {
      "data-file-tree-context-menu-root": "true",
      class: cn(
        "min-w-44 rounded-md border border-border bg-popover p-1",
        "shadow-md text-popover-foreground text-sm",
      ),
    },
    ...items,
  );
}
