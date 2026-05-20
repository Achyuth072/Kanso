export type SortOption = "date" | "priority" | "alphabetical" | "custom";
export type GroupOption = "none" | "priority" | "date" | "project";

export const SORT_LABELS: Record<SortOption, string> = {
  date: "Due Date",
  priority: "Priority",
  alphabetical: "Alphabetical",
  custom: "Custom",
};

export const GROUP_LABELS: Record<GroupOption, string> = {
  none: "None",
  priority: "Priority",
  date: "Due Date",
  project: "Project",
};
