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
import { useBackAnchor } from "@/lib/hooks/useBackAnchor";
import { AUTH_STANDALONE_ROUTES, isAdminRoute } from "@/lib/auth/auth-routes";
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
import { EncryptionGate } from "@/components/encryption/EncryptionGate";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/store/uiStore";
import { purgeLegacyStorage } from "@/lib/storage-cleanup";
import {
  prefetchChangelog,
  invalidateChangelogCache,
  isNewerThan,
  fetchLatestVersion,
  RELEASE_CHANNEL,
} from "@/lib/changelog-cache";
import { useCalendarStore } from "@/lib/calendar/store";
import { useWeeklyBackup } from "@/lib/hooks/useWeeklyBackup";
import { GlobalFabs } from "@/components/layout/GlobalFabs";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Toaster } from "@/components/ui/toaster";
import { useIsBoardViewOnTasks } from "@/lib/hooks/useIsBoardViewOnTasks";
import { useActiveBanner } from "@/components/bannerSlot";
import { trackSignupCompleted, trackAppOpened } from "@/lib/telemetry/client";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

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
const DemoBar = dynamic(
  () => import("@/components/DemoBar").then((mod) => mod.DemoBar),
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
const TelemetryConsentPrompt = dynamic(
  () =>
    import("@/components/telemetry/TelemetryConsentPrompt").then(
      (mod) => mod.TelemetryConsentPrompt,
    ),
  { ssr: false },
);

interface AppShellProps {
  children: React.ReactNode;
}

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
        const info = await fetchLatestVersion();
        if (!info) return;
        // Stable builds should not react to preview-only releases.
        if (RELEASE_CHANNEL === "stable" && info.channel !== "stable") return;
        setServerVersion((prev) => {
          if (prev !== info.version) {
            invalidateChangelogCache();
          }
          return info.version;
        });
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
      onOpenChange={(val) => {
        if (!val) {
          setChangelogOpen(false);
          setLastDismissedVersion(effectiveVersion);
        }
      }}
    />
  );
}

function GlobalOverlays({
  commandOpen,
  onCommandOpenChange,
}: {
  commandOpen: boolean;
  onCommandOpenChange: (open: boolean) => void;
}) {
  const { isAddTaskOpen, closeAddTask } = useTaskActions();
  const { isHabitSheetOpen, editingHabit, initialTab, closeHabitSheet } =
    useHabitActions();
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
  const isBoardViewOnTasks = useIsBoardViewOnTasks();

  return (
    <>
      <TaskSheet open={isAddTaskOpen} onClose={closeAddTask} />
      <HabitSheet
        open={isHabitSheetOpen}
        onClose={closeHabitSheet}
        initialHabit={editingHabit}
        initialTab={initialTab}
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
        isBoardViewOnTasks={isBoardViewOnTasks}
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
      <ChangelogPopupWatcher />
      <ChangelogManualTrigger />
      <TelemetryConsentPrompt />
    </>
  );
}

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
      onOpenChange={(val) => {
        if (!val) setForceVersion(null);
      }}
    />
  );
}

function AppShellContent({ children }: AppShellProps) {
  const pathname = usePathname();
  const isFocus = pathname === "/focus";
  const hideMobileNav = pathname === "/focus" || pathname === "/settings";
  const hasTopBanner = useActiveBanner() !== null;

  // Must run inside EncryptionGate so converting guests set a passphrase
  // before local data is encrypted and uploaded.
  const { isMigrating } = useMigrationStrategy();

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

  // Set on root before paint so sibling overlays inherit the offset without a flash.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      "--offline-pill-offset",
      hasTopBanner ? "3.5rem" : "0px",
    );
  }, [hasTopBanner]);

  useWeeklyBackup();

  useEffect(() => {
    trackAppOpened();

    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") === "1") {
      trackSignupCompleted();
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("signup");
      window.history.replaceState({}, "", cleanUrl.toString());
    }
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <CompletedTasksProvider>
      {isMigrating && <LoaderOverlay message="Migrating guest data..." />}
      <SidebarProvider defaultOpen={true}>
        <GlobalHotkeys
          setCommandOpen={setCommandOpen}
          setHelpOpen={setShortcutsHelpOpen}
          commandOpen={commandOpen}
        />
        {!hideMobileNav && <Header setCommandOpen={setCommandOpen} />}

        {!isFocus && <AppSidebar />}

        <SidebarInset
          className="relative"
          style={
            {
              "--offline-banner-top": hideMobileNav
                ? "env(safe-area-inset-top, 0px)"
                : "var(--mobile-header-height)",
            } as React.CSSProperties
          }
        >
          <div
            ref={scrollContainerRef}
            data-testid="scroll-container"
            className={cn(
              "flex-1 w-full min-w-0 md:pt-0 md:pb-0",
              pathname === "/calendar" ||
                isFocus ||
                pathname === "/" ||
                pathname === "/habits" ||
                pathname === "/settings"
                ? "overflow-hidden"
                : "overflow-y-auto overflow-x-hidden scrollbar-hide",
              !hideMobileNav &&
                !hasTopBanner &&
                "pt-[var(--mobile-header-height)]",
              !hideMobileNav &&
                hasTopBanner &&
                "pt-[calc(var(--mobile-header-height)+var(--offline-banner-height))]",
              hideMobileNav &&
                hasTopBanner &&
                "pt-[var(--offline-banner-height)]",
            )}
          >
            {children}
            {!hideMobileNav && pathname === "/" && (
              <div
                className="h-[calc(var(--mobile-nav-height)+3.5rem)] w-full flex-none md:hidden"
                aria-hidden="true"
              />
            )}
            {!hideMobileNav && pathname !== "/" && pathname !== "/calendar" && (
              <div
                className="h-[calc(var(--mobile-nav-height)+0.5rem)] w-full flex-none md:hidden"
                aria-hidden="true"
              />
            )}
          </div>
          <OfflineIndicator />
          <DemoBar />
          <Toaster />
        </SidebarInset>

        {!hideMobileNav && <MobileNav />}

        {/* Rendered outside template animation to prevent shifts */}
        <GlobalFabs />

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
  const pathname = usePathname();
  // Admin routes are self-contained pages with their own nav — they never
  // need the app sidebar/header shell.
  const isBareRoute =
    AUTH_STANDALONE_ROUTES.includes(pathname) || isAdminRoute(pathname);

  useBackAnchor(); // must stay mounted across navigation — see useBackAnchor.ts

  useEffect(() => {
    purgeLegacyStorage();
  }, []);

  return (
    <ProjectActionsProvider>
      <TaskActionsProvider>
        <HabitActionsProvider>
          <PiPProvider>
            {loading || !user || isBareRoute ? (
              <>{children}</>
            ) : (
              <EncryptionGate>
                <AppShellContent>{children}</AppShellContent>
              </EncryptionGate>
            )}
          </PiPProvider>
        </HabitActionsProvider>
      </TaskActionsProvider>
    </ProjectActionsProvider>
  );
}
