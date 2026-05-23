export type WorkspacePanelType = "terminal" | "git" | "explorer";

export interface ClientWorkspacePanel {
  id: string;
  type: Exclude<WorkspacePanelType, "terminal">;
  title: string;
}
