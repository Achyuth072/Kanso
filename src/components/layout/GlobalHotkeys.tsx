"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTaskActions } from "@/components/TaskActionsProvider";
import { useCompletedTasks } from "@/components/CompletedTasksProvider";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { useProjectActions } from "@/components/ProjectActionsProvider";
import { useUiStore } from "@/lib/store/uiStore";
import { useCalendarStore } from "@/lib/calendar/store";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

interface GlobalHotkeysProps {
  setCommandOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setHelpOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  commandOpen?: boolean;
}

export function GlobalHotkeys({
  setCommandOpen,
  setHelpOpen,
  commandOpen,
}: GlobalHotkeysProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const { openAddTask, isAddTaskOpen } = useTaskActions();
  const { openSheet: openCompletedSheet } = useCompletedTasks();
  const { openAddHabit, isHabitSheetOpen } = useHabitActions();
  const { openCreateProject, isCreateProjectOpen } = useProjectActions();
  const { openCreateEvent, isCreateEventOpen } = useCalendarStore();
  const setViewMode = useUiStore((state) => state.setViewMode);
  const setArchivedProjectsOpen = useUiStore(
    (state) => state.setArchivedProjectsOpen,
  );
  const isShortcutsHelpOpen = useUiStore((state) => state.isShortcutsHelpOpen);
  const isArchivedProjectsOpen = useUiStore(
    (state) => state.isArchivedProjectsOpen,
  );
  const isChangelogOpen = useUiStore((state) => state.isChangelogOpen);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // True when any overlay that captures keyboard input is open
  const isOtherModalOpen =
    isAddTaskOpen ||
    isHabitSheetOpen ||
    isCreateProjectOpen ||
    isCreateEventOpen ||
    isShortcutsHelpOpen ||
    isArchivedProjectsOpen ||
    isChangelogOpen;
  const isAnyModalOpen = isOtherModalOpen || !!commandOpen;

  const options = {
    preventDefault: true,
    enableOnFormTags: false,
    enabled: !isAnyModalOpen,
  };

  // --- ACTIONS ---

  // New Task (n)
  useHotkeys("n", () => openAddTask(), options);

  // New Habit (h)
  useHotkeys("h", () => openAddHabit(), options);

  // New Event (e)
  useHotkeys("e", () => openCreateEvent(), options);

  // New Project (p)
  useHotkeys("p", () => openCreateProject(), options);

  // Archived Projects (a)
  useHotkeys("a", () => setArchivedProjectsOpen(true), options);

  // Toggle Logbook (c)
  useHotkeys("c", () => openCompletedSheet(), options);

  useHotkeys(
    ["mod+k"],
    (event) => {
      if (event.repeat) return;
      setCommandOpen((prev) => !prev);
    },
    { ...options, enabled: !isOtherModalOpen },
  );

  // Theme Cycle (t)
  useHotkeys(
    "t",
    (event) => {
      if (event.repeat) return;
      const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
      setTheme(nextTheme);
    },
    options,
  );

  // Shortcuts Help (Shift+H)
  useHotkeys(
    ["shift+h", "shift+/", "?"],
    (event) => {
      if (event.repeat) return;
      setHelpOpen((prev) => !prev);
    },
    options,
  );

  // Focus Mode (f)
  useHotkeys("f", () => router.push("/focus"), options);

  // View Switching Shortcuts (Shift + 1/2/3)
  useHotkeys(
    "shift+1",
    () => {
      setViewMode("list");
      if (pathname !== "/") router.push("/");
    },
    options,
  );

  useHotkeys(
    "shift+2",
    () => {
      if (isDesktop) {
        setViewMode("board");
        if (pathname !== "/") router.push("/");
      }
    },
    options,
  );

  useHotkeys(
    "shift+3",
    () => {
      setViewMode("grid");
      if (pathname !== "/") router.push("/");
    },
    options,
  );

  // Escape to close Focus Mode (if on focus page) and other sheets
  useHotkeys(
    "esc",
    (event) => {
      if (window.location.pathname === "/focus") {
        event.preventDefault();
        router.push("/");
      }
    },
    { enableOnFormTags: true },
  );

  // --- NAVIGATION (g + 1-6, or just 1-6?) ---
  // Using 1-6 for quick tab switching is standard
  useHotkeys("1", () => router.push("/"), options); // Home/Tasks
  useHotkeys("2", () => router.push("/habits"), options); // Habits
  useHotkeys("3", () => router.push("/calendar"), options); // Calendar
  useHotkeys("4", () => router.push("/stats"), options); // Statistics
  useHotkeys("5", () => router.push("/focus"), options); // Focus
  useHotkeys("6", () => router.push("/settings"), options); // Settings

  return null;
}
