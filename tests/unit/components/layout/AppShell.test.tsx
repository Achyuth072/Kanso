/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
// import { Inter } from "next/font/google";

// Mock next/font/google
vi.mock("next/font/google", () => ({
  Inter: vi.fn(() => ({
    variable: "--font-inter",
    style: { fontFamily: "Inter" },
  })),
}));

// Mock everything early
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), prefetch: vi.fn() })),
  useSearchParams: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ user: { id: "user-1" }, loading: false })),
}));

vi.mock("@/components/CompletedTasksProvider", () => {
  const MockProvider = ({ children }: any) => (
    <div data-testid="completed-tasks-provider">{children}</div>
  );
  return {
    __esModule: true,
    default: MockProvider,
    CompletedTasksProvider: MockProvider,
    useCompletedTasks: vi.fn(() => ({
      openSheet: vi.fn(),
      showCompleted: false,
    })),
  };
});

vi.mock("@/components/TimerProvider", () => ({
  TimerProvider: ({ children }: any) => <div>{children}</div>,
  useTimer: vi.fn(() => ({ state: { remainingSeconds: 0 }, start: vi.fn() })),
}));

vi.mock("@/components/TaskActionsProvider", () => ({
  TaskActionsProvider: ({ children }: any) => <div>{children}</div>,
  useTaskActions: vi.fn(() => ({
    isAddTaskOpen: false,
    closeAddTask: vi.fn(),
  })),
}));

vi.mock("@/components/ProjectActionsProvider", () => ({
  ProjectActionsProvider: ({ children }: any) => <div>{children}</div>,
  useProjectActions: vi.fn(() => ({
    isCreateProjectOpen: false,
    closeCreateProject: vi.fn(),
  })),
}));

vi.mock("@/components/HabitActionsProvider", () => ({
  HabitActionsProvider: ({ children }: any) => <div>{children}</div>,
  useHabitActions: vi.fn(() => ({
    isHabitSheetOpen: false,
    closeHabitSheet: vi.fn(),
  })),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: vi.fn(() => ({ trigger: vi.fn() })),
}));
vi.mock("@/lib/hooks/useRealtimeSync", () => ({ useRealtimeSync: vi.fn() }));
vi.mock("@/lib/hooks/useWeeklyBackup", () => ({
  useWeeklyBackup: vi.fn(() => ({
    lastBackupDate: null,
    triggerBackup: vi.fn(),
    updateLastBackupDate: vi.fn(),
  })),
}));
vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => false),
}));
vi.mock("@/lib/hooks/useMigrationStrategy", () => ({
  useMigrationStrategy: vi.fn(() => ({ isMigrating: false })),
}));

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: vi.fn((sel: (s: any) => any) => {
    const state = {
      setIsDesktop: vi.fn(),
      setShortcutsHelpOpen: vi.fn(),
      isPipActive: false,
      isProjectsOpen: true,
      isShortcutsHelpOpen: false,
      isArchivedProjectsOpen: false,
      setArchivedProjectsOpen: vi.fn(),
    };
    return sel ? sel(state) : state;
  }),
}));

vi.mock("@/lib/calendar/store", () => ({
  useCalendarStore: vi.fn(() => ({
    isCreateEventOpen: false,
    closeCreateEvent: vi.fn(),
    defaultDate: null,
    selectedEvent: null,
    openCreateEvent: vi.fn(),
  })),
}));

vi.mock("@/components/providers/PiPProvider", () => ({
  PiPProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Layout Components Mocks
vi.mock("@/components/layout/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="sidebar" />,
}));
vi.mock("@/components/layout/Header", () => ({
  Header: () => <div data-testid="header" />,
}));
vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}));
vi.mock("@/components/layout/GlobalHotkeys", () => ({
  GlobalHotkeys: () => <div data-testid="global-hotkeys" />,
}));
vi.mock("@/components/layout/GlobalFabs", () => ({
  GlobalFabs: () => <div data-testid="global-fabs" />,
}));
vi.mock("@/components/habits/HabitSheet", () => ({ HabitSheet: () => null }));
vi.mock("@/components/tasks/TaskSheet", () => ({ TaskSheet: () => null }));
vi.mock("@/components/projects/CreateProjectDialog", () => ({
  CreateProjectDialog: () => null,
}));
vi.mock("@/components/projects/ProjectDialogs", () => ({
  ProjectDialogs: () => null,
}));
vi.mock("@/components/command-menu", () => ({ CommandMenu: () => null }));
vi.mock("@/components/ui/ShortcutsHelp", () => ({ ShortcutsHelp: () => null }));
vi.mock("@/components/ui/loader-overlay", () => ({
  LoaderOverlay: () => null,
}));
vi.mock("@/components/projects/ArchivedProjectsDialog", () => ({
  ArchivedProjectsDialog: () => null,
}));
vi.mock("@/components/FloatingTimer", () => ({ FloatingTimer: () => null }));
vi.mock("@/components/OfflineIndicator", () => ({
  OfflineIndicator: () => null,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SidebarInset: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <main className={className} data-testid="sidebar-inset">
      {children}
    </main>
  ),
  useSidebar: () => ({ state: "expanded", isMobile: false }),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

import AppShell from "@/components/layout/AppShell";
import { usePathname } from "next/navigation";

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly with children", async () => {
    vi.mocked(usePathname).mockReturnValue("/");

    render(
      <AppShell>
        <div data-testid="content">Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
  });

  it("applies overflow-y-auto class for specific paths like /stats", async () => {
    vi.mocked(usePathname).mockReturnValue("/stats");

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("scroll-container")).toHaveClass(
      "overflow-y-auto",
    );
  });

  it("applies overflow-hidden class for specific paths like /habits", async () => {
    vi.mocked(usePathname).mockReturnValue("/habits");

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("scroll-container")).toHaveClass(
      "overflow-hidden",
    );
  });

  it("hides MobileNav on /focus page", async () => {
    vi.mocked(usePathname).mockReturnValue("/focus");

    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.queryByTestId("mobile-nav")).not.toBeInTheDocument();
  });
});
