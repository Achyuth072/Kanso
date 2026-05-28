"use client";

import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/AuthProvider";
import { CompletedTasksProvider } from "@/components/CompletedTasksProvider";
import {
  TaskActionsProvider,
  useTaskActions,
} from "@/components/TaskActionsProvider";
import {
  ProjectActionsProvider,
  useProjectActions,
} from "@/components/ProjectActionsProvider";
import { useRealtimeSync } from "@/lib/hooks/useRealtimeSync";
import { PiPProvider } from "@/components/providers/PiPProvider";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar as SidebarComponent } from "@/components/layout/AppSidebar";
import { MobileNav as MobileNavComponent } from "@/components/layout/MobileNav";
import { Header as HeaderComponent } from "@/components/layout/Header";

// Memoize core UI shells to prevent re-renders when global modal state changes (PERF-01)
const AppSidebar = React.memo(SidebarComponent);
const MobileNav = React.memo(MobileNavComponent);
const Header = React.memo(HeaderComponent);
import { HabitSheet } from "@/components/habits/HabitSheet";
import {
  HabitActionsProvider,
  useHabitActions,
} from "@/components/habits/HabitActionsProvider";
import { GlobalHotkeys } from "@/components/layout/GlobalHotkeys";
import { useMigrationStrategy } from "@/lib/hooks/useMigrationStrategy";
import { LoaderOverlay } from "@/components/ui/loader-overlay";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/store/uiStore";
import {
  prefetchChangelog,
  invalidateChangelogCache,
  isNewerThan,
} from "@/lib/changelog-cache";
import { useCalendarStore } from "@/lib/calendar/store";
import { useWeeklyBackup } from "@/lib/hooks/useWeeklyBackup";
import { GlobalFabs } from "@/components/layout/GlobalFabs";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Toaster } from "@/components/ui/notification";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

// Global Overlays (Lazy Loaded)
const TaskSheet = dynamic(() => import("@/components/tasks/TaskSheet"), {
  ssr: false,
});
const CommandMenu = dynamic(
  () => import("@/components/command-menu").then((mod) => mod.CommandMenu),
  { ssr: false },
);
const OfflineIndicator = dynamic(
  () =>
    import("@/components/OfflineIndicator").then((mod) => mod.OfflineIndicator),
  { ssr: false },
);
const ShortcutsHelp = dynamic(
  () =>
    import("@/components/ui/ShortcutsHelp").then((mod) => mod.ShortcutsHelp),
  { ssr: false },
);
const CreateProjectDialog = dynamic(
  () =>
    import("@/components/projects/CreateProjectDialog").then(
      (mod) => mod.CreateProjectDialog,
    ),
  { ssr: false },
);
const FloatingTimer = dynamic(
  () => import("@/components/FloatingTimer").then((mod) => mod.FloatingTimer),
  { ssr: false },
);
const ChangelogPopup = dynamic(
  () =>
    import("@/components/ui/ChangelogPopup").then((mod) => mod.ChangelogPopup),
  { ssr: false },
);
const CreateEventDialog = dynamic(
  () =>
    import("@/components/calendar/CreateEventDialog").then(
      (mod) => mod.CreateEventDialog,
    ),
  { ssr: false },
);

const ProjectDialogs = dynamic(
  () =>
    import("@/components/projects/ProjectDialogs").then(
      (mod) => mod.ProjectDialogs,
    ),
  { ssr: false },
);
const ArchivedProjectsDialog = dynamic(
  () =>
    import("@/components/projects/ArchivedProjectsDialog").then(
      (mod) => mod.ArchivedProjectsDialog,
    ),
  { ssr: false },
);

interface AppShellProps {
  children: React.ReactNode;
}

// Watches app version, syncs hasChangelogUpdate to store, renders the popup
function ChangelogPopupWatcher() {
  const lastDismissedVersion = useUiStore(
    (state) => state.lastDismissedVersion,
  );
  const setLastDismissedVersion = useUiStore(
    (state) => state.setLastDismissedVersion,
  );
  const isChangelogOpen = useUiStore((state) => state.isChangelogOpen);
  const setChangelogOpen = useUiStore((state) => state.setChangelogOpen);
  const setHasChangelogUpdate = useUiStore(
    (state) => state.setHasChangelogUpdate,
  );
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    prefetchChangelog();
  }, []);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const res = await fetch("/changelog.json", { cache: "no-store" });
        const data = await res.json();
        if (data?.[0]?.version) {
          setServerVersion((prev) => {
            if (prev !== data[0].version) {
              invalidateChangelogCache();
            }
            return data[0].version;
          });
        }
      } catch {
        // ignore
      }
    };

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);
    const onVisible = () => {
      if (!document.hidden) checkForUpdates();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const effectiveVersion = serverVersion || APP_VERSION;
  const hasNewVersion = isNewerThan(effectiveVersion, lastDismissedVersion);

  useEffect(() => {
    setHasChangelogUpdate(hasNewVersion);
  }, [hasNewVersion, setHasChangelogUpdate]);

  return (
    <ChangelogPopup
      open={isChangelogOpen}
      appVersion={APP_VERSION}
      forceVersion={serverVersion || undefined}
      onOpenChange={(val) => {
        if (!val) {
          setChangelogOpen(false);
          setLastDismissedVersion(effectiveVersion);
        }
      }}
    />
  );
}

// Separate Overlay layer to isolate modal/sheet state
function GlobalOverlays({
  commandOpen,
  onCommandOpenChange,
}: {
  commandOpen: boolean;
  onCommandOpenChange: (open: boolean) => void;
}) {
  const { isAddTaskOpen, closeAddTask } = useTaskActions();
  const { isHabitSheetOpen, editingHabit, closeHabitSheet } = useHabitActions();
  const { isCreateEventOpen, closeCreateEvent, defaultDate, selectedEvent } =
    useCalendarStore();
  const { isCreateProjectOpen, closeCreateProject } = useProjectActions();
  const isShortcutsHelpOpen = useUiStore((state) => state.isShortcutsHelpOpen);
  const setShortcutsHelpOpen = useUiStore(
    (state) => state.setShortcutsHelpOpen,
  );
  const isArchivedProjectsOpen = useUiStore(
    (state) => state.isArchivedProjectsOpen,
  );
  const setArchivedProjectsOpen = useUiStore(
    (state) => state.setArchivedProjectsOpen,
  );

  return (
    <>
      <TaskSheet open={isAddTaskOpen} onClose={closeAddTask} />
      <HabitSheet
        open={isHabitSheetOpen}
        onClose={closeHabitSheet}
        initialHabit={editingHabit}
      />
      <CreateProjectDialog
        open={isCreateProjectOpen}
        onOpenChange={closeCreateProject}
      />
      <ProjectDialogs />
      <CommandMenu open={commandOpen} onOpenChange={onCommandOpenChange} />
      <ShortcutsHelp
        open={isShortcutsHelpOpen}
        onOpenChange={setShortcutsHelpOpen}
      />
      <CreateEventDialog
        open={isCreateEventOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateEvent();
        }}
        defaultDate={defaultDate}
        event={selectedEvent}
      />
      <ArchivedProjectsDialog
        open={isArchivedProjectsOpen}
        onOpenChange={setArchivedProjectsOpen}
      />
      <FloatingTimer />
      <OfflineIndicator />
      <ChangelogPopupWatcher />
      <ChangelogManualTrigger />
    </>
  );
}

// Allows ?changelog query param to manually open the popup
function ChangelogManualTrigger() {
  const [forceVersion, setForceVersion] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("changelog")) return null;
    return params.get("changelog") || APP_VERSION;
  });

  return (
    <ChangelogPopup
      open={forceVersion !== null}
      appVersion={APP_VERSION}
      onOpenChange={(val) => {
        if (!val) setForceVersion(null);
      }}
      forceVersion={forceVersion || undefined}
    />
  );
}

function AppShellContent({ children }: AppShellProps) {
  const pathname = usePathname();
  const isFocus = pathname === "/focus";
  const hideMobileNav = pathname === "/focus" || pathname === "/settings";

  const setShortcutsHelpOpen = useUiStore(
    (state) => state.setShortcutsHelpOpen,
  );
  const setIsDesktop = useUiStore((state) => state.setIsDesktop);
  const [commandOpen, setCommandOpen] = useState(false);

  // Sync isDesktop state globally to reduce hook overhead in list items
  const isDesktop = useMediaQuery("(min-width: 768px)");
  useLayoutEffect(() => {
    setIsDesktop(isDesktop);
  }, [isDesktop, setIsDesktop]);

  // Global realtime sync - stays alive during navigation
  useRealtimeSync();

  // Global backup reminder for guest mode
  useWeeklyBackup();

  // Reset scroll position on navigation to prevent layout shifts
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <CompletedTasksProvider>
      <SidebarProvider defaultOpen={true}>
        <GlobalHotkeys
          setCommandOpen={setCommandOpen}
          setHelpOpen={setShortcutsHelpOpen}
          commandOpen={commandOpen}
        />
        {/* Mobile Top Bar - hidden on Focus and Settings pages */}
        {!hideMobileNav && <Header />}

        {/* Desktop Sidebar - hidden only on Focus page */}
        {!isFocus && <AppSidebar />}

        {/* Main Content with proper inset */}
        <SidebarInset className="relative">
          <div
            ref={scrollContainerRef}
            data-testid="scroll-container"
            className={cn(
              "flex-1 w-full min-w-0 md:pt-0 md:pb-0",
              pathname === "/calendar" ||
                isFocus ||
                pathname === "/" ||
                pathname === "/habits"
                ? "overflow-hidden"
                : "overflow-y-auto overflow-x-hidden scrollbar-hide",
              !hideMobileNav && "pt-[calc(4rem+env(safe-area-inset-top,0px))]",
            )}
          >
            {children}
            {!hideMobileNav && pathname === "/" && (
              <div
                className="h-32 w-full flex-none md:hidden"
                aria-hidden="true"
              />
            )}
            {!hideMobileNav && pathname !== "/" && pathname !== "/calendar" && (
              <div
                className="h-20 w-full flex-none md:hidden"
                aria-hidden="true"
              />
            )}
          </div>
          <Toaster />
        </SidebarInset>

        {/* Mobile Bottom Nav - hidden on Focus and Settings pages */}
        {!hideMobileNav && <MobileNav />}

        {/* FABs - Rendered outside template animation to prevent shifts */}
        <GlobalFabs />

        {/* Global Overlays */}
        <GlobalOverlays
          commandOpen={commandOpen}
          onCommandOpenChange={setCommandOpen}
        />
      </SidebarProvider>
    </CompletedTasksProvider>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const { user, loading } = useAuth();
  const { isMigrating } = useMigrationStrategy();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <ProjectActionsProvider>
      <TaskActionsProvider>
        <HabitActionsProvider>
          <PiPProvider>
            {loading || !user || isLoginPage ? (
              <>{children}</>
            ) : (
              <AppShellContent>{children}</AppShellContent>
            )}
          </PiPProvider>
        </HabitActionsProvider>
      </TaskActionsProvider>
      {isMigrating && <LoaderOverlay message="Migrating guest data..." />}
    </ProjectActionsProvider>
  );
}
