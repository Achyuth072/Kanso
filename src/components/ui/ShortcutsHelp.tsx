"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Keyboard } from "lucide-react";
import { getPlatformKey } from "@/lib/utils/platform";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const getShortcuts = (platformKey: string): ShortcutGroup[] => [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["1"], description: "Go to Tasks" },
      { keys: ["2"], description: "Go to Habits" },
      { keys: ["3"], description: "Go to Calendar" },
      { keys: ["4"], description: "Go to Stats" },
      { keys: ["5"], description: "Go to Focus" },
      { keys: ["6"], description: "Go to Settings" },
      { keys: [platformKey, "b"], description: "Toggle Sidebar" },
      { keys: ["Esc"], description: "Close Focus/Dialogs" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["n"], description: "New Task" },
      { keys: ["h"], description: "Create Habit" },
      { keys: ["e"], description: "New Event" },
      { keys: ["p"], description: "New Project" },
      { keys: ["a"], description: "Archived Projects" },
      { keys: ["c"], description: "Toggle Completed Tasks" },
      { keys: [platformKey, "Enter"], description: "Save Task" },
      { keys: [platformKey, "K"], description: "Search / Command Menu" },
      { keys: ["T"], description: "Switch Theme" },
      { keys: ["f"], description: "Focus Mode" },
      { keys: ["Shift", "h"], description: "Show Shortcuts" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: ["Shift", "1"], description: "List View" },
      { keys: ["Shift", "2"], description: "Grid View" },
      { keys: ["Shift", "3"], description: "Board View" },
    ],
  },
  {
    title: "Task List (Vim)",
    shortcuts: [
      { keys: ["j"], description: "Select Next Task" },
      { keys: ["k"], description: "Select Previous Task" },
      { keys: ["d"], description: "Delete Selected" },
      { keys: ["e"], description: "Edit Selected" },
      { keys: ["Space"], description: "Toggle Completion" },
    ],
  },
];

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  const platformKey = getPlatformKey();
  const shortcuts = getShortcuts(platformKey);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[550px] border-border/80 shadow-none p-0">
        <ResponsiveDialogHeader className="p-6 pb-2 border-b border-border/80">
          <ResponsiveDialogTitle className="flex items-center gap-2.5 text-[24px] font-semibold tracking-[-0.02em] text-foreground">
            <Keyboard className="h-5 w-5 text-muted-foreground/70" />
            Keyboard Shortcuts
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-[11px] uppercase tracking-[0.02em] text-muted-foreground font-medium pt-1">
            Refine your workflow with Kanso
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[60vh] overflow-y-auto scrollbar-hide p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {shortcuts.map((group) => (
              <div key={group.title} className="space-y-4">
                <h3 className="text-[18px] font-medium tracking-[-0.01em] text-foreground pb-2 border-b border-border/80">
                  {group.title}
                </h3>
                <div className="space-y-3.5">
                  {group.shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[15px] font-medium tracking-[0.01em]"
                    >
                      <span className="text-foreground/90 font-medium">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-2.5">
                        {shortcut.keys.map((key) => (
                          <kbd
                            key={key}
                            className="pointer-events-none h-6.5 min-w-[28px] select-none items-center justify-center rounded border border-border bg-sidebar px-2 font-mono text-[12px] font-medium text-foreground shadow-none flex"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
