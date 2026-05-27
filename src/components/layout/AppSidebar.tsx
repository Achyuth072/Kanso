"use client";

import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import packageJson from "../../../package.json";
const { version } = packageJson;
import type { Project } from "@/lib/types/task";
import {
  SIDEBAR_COLLAPSE,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  CheckSquare,
  Calendar,
  BarChart3,
  Layers,
  Timer,
  Settings,
  Plus,
  Inbox,
  FolderKanban,
  ChevronDown,
  Trash2,
  ArchiveRestore,
  EllipsisVertical,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useCompletedTasks } from "@/components/CompletedTasksProvider";
import { useProjects } from "@/lib/hooks/useProjects";
import { useProjectActions } from "@/components/ProjectActionsProvider";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { ArchivedProjectsDialog } from "@/components/projects/ArchivedProjectsDialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const mainNavItems = [
  { label: "All Tasks", icon: CheckSquare, path: "/", isAction: false },
  { label: "Habits", icon: Layers, path: "/habits", isAction: false },
  { label: "Calendar", icon: Calendar, path: "/calendar", isAction: false },
  { label: "Stats", icon: BarChart3, path: "/stats", isAction: false },
];

const secondaryNavItems = [
  { label: "Focus", icon: Timer, path: "/focus", isAction: false },
  { label: "Settings", icon: Settings, path: "/settings", isAction: false },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const { openSheet } = useCompletedTasks();
  const { data: projects } = useProjects();
  const { openCreateProject, openEditProject, openDeleteProject } =
    useProjectActions();
  const isProjectsOpen = useUiStore((state) => state.isProjectsOpen);
  const toggleProjectsOpen = useUiStore((state) => state.toggleProjectsOpen);
  const hasChangelogUpdate = useUiStore((state) => state.hasChangelogUpdate);
  const setChangelogOpen = useUiStore((state) => state.setChangelogOpen);
  const { trigger } = useHaptic();

  const [mobileActionProject, setMobileActionProject] =
    useState<Project | null>(null);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

  const currentProjectId = searchParams.get("project");

  // Prefetch all routes on mount for instant navigation
  useEffect(() => {
    const allRoutes = [...mainNavItems, ...secondaryNavItems].map(
      (item) => item.path,
    );
    allRoutes.forEach((path) => router.prefetch(path));
  }, [router]);

  const handleMobileRouteIntent = () => {
    trigger("toggle");
    // Let the route change close the mobile sidebar via SidebarProvider.
    // Closing it on a timer can race the sheet's history cleanup and cancel navigation.
  };

  return (
    <>
      <Sidebar variant="sidebar" collapsible="icon" className="h-screen">
        <SidebarHeader>
          <div className="flex items-center py-2 h-14 pl-0.5">
            {/* K logo — always in-flow, left-aligned matching nav icons */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold shrink-0">
              K
            </div>
            {/* Label + trigger hidden when collapsed (matching nav item pattern) */}
            <div className={cn("flex items-center justify-between ml-2 flex-1", SIDEBAR_COLLAPSE.hideContent)}>
              <span className="type-h2 whitespace-nowrap">Kanso</span>
              <SidebarTrigger className="h-9 w-9 shrink-0 active:scale-95 transition-all [&_svg]:stroke-[2.25px]" />
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNavItems
                  .filter((item) => {
                    if (isMobile) {
                      return (
                        item.label !== "Stats" && item.label !== "Calendar"
                      );
                    }
                    return true;
                  })
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      item.label === "All Tasks"
                        ? pathname === item.path &&
                          (!currentProjectId || currentProjectId === "all")
                        : pathname === item.path && !item.isAction;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                        >
                          <Link
                            href={
                              item.label === "All Tasks"
                                ? "/?project=all"
                                : item.path
                            }
                            onClick={(e) => {
                              if (item.isAction) {
                                trigger("toggle");
                                e.preventDefault();
                                openSheet();
                                if (isMobile) setOpenMobile(false);
                              } else {
                                handleMobileRouteIntent();
                              }
                            }}
                          >
                            <div className="flex items-center justify-center w-5 h-5 shrink-0">
                              <Icon className="h-4 w-4" strokeWidth={2.25} />
                            </div>
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Projects Section */}
          <SidebarGroup>
            <SidebarGroupLabel
              className="cursor-pointer text-sidebar-foreground [&_svg]:opacity-100"
              onClick={() => {
                trigger("toggle");
                toggleProjectsOpen();
              }}
            >
              <FolderKanban strokeWidth={2.25} />
              <span className="flex-1">Projects</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isProjectsOpen ? "" : "-rotate-90"
                }`}
              />
              <button
                type="button"
                title="Add Project"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-sidebar-foreground outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2"
                onClick={(e) => {
                  e.stopPropagation();
                  trigger("toggle");
                  openCreateProject();
                }}
              >
                <Plus className="h-5 w-5 md:h-4 md:w-4" />
              </button>
            </SidebarGroupLabel>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-seijaku",
                isProjectsOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <SidebarGroupContent>
                  <SidebarMenu className="pl-2 group-data-[collapsible=icon]:pl-0">
                    {/* Inbox */}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={currentProjectId === "inbox"}
                        tooltip="Inbox"
                      >
                        <Link
                          href="/?project=inbox"
                          onClick={() => {
                            handleMobileRouteIntent();
                          }}
                        >
                          <div className="flex items-center justify-center w-5 h-5 shrink-0">
                            <Inbox className="h-4 w-4" strokeWidth={2.25} />
                          </div>
                          <span>Inbox</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* User Projects */}
                    {projects
                      ?.filter((p) => !p.is_inbox)
                      .map((project) => (
                        <SidebarMenuItem key={project.id} className="relative">
                          <SidebarMenuButton
                            asChild
                            isActive={currentProjectId === project.id}
                            tooltip={project.name}
                            className="peer"
                          >
                            <Link
                              href={`/?project=${project.id}`}
                              onClick={() => {
                                handleMobileRouteIntent();
                              }}
                            >
                              <div className="flex items-center justify-center w-5 h-5 shrink-0">
                                <div
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: project.color }}
                                />
                              </div>
                              <span className="truncate">{project.name}</span>
                            </Link>
                          </SidebarMenuButton>

                          {/* Project Actions */}
                          {/* Project Actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction
                                showOnHover={!isMobile}
                                className="peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
                                onClick={(e) => {
                                  if (isMobile) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    trigger("toggle");
                                    setMobileActionProject(project);
                                  }
                                }}
                              >
                                <EllipsisVertical
                                  className="h-4 w-4"
                                  strokeWidth={2.25}
                                />
                                <span className="sr-only">More</span>
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            {!isMobile && (
                              <DropdownMenuContent
                                side="right"
                                align="start"
                                className="w-48"
                              >
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    trigger("toggle");
                                    openEditProject(project);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <Pencil
                                    className="h-4 w-4"
                                    strokeWidth={2.25}
                                  />
                                  <span>Edit Project</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    trigger("thud");
                                    openDeleteProject(project);
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete Project</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            )}
                          </DropdownMenu>
                        </SidebarMenuItem>
                      ))}

                    {/* Archived Projects */}
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => {
                          trigger("toggle");
                          setIsArchivedOpen(true);
                        }}
                        tooltip="Archived Projects"
                      >
                        <div className="flex items-center justify-center w-5 h-5 shrink-0">
                          <ArchiveRestore
                            className="h-4 w-4"
                            strokeWidth={2.25}
                          />
                        </div>
                        <span className="truncate">Archived Projects</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </div>
            </div>
          </SidebarGroup>

          {!isMobile && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {secondaryNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.path;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                        >
                          <Link
                            href={item.path}
                            onClick={() => {
                              trigger("toggle");
                            }}
                          >
                            <div className="flex items-center justify-center w-5 h-5 shrink-0">
                              <Icon className="h-4 w-4" strokeWidth={2.25} />
                            </div>
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-border overflow-hidden md:p-2 p-0">
          {isMobile && (
            <SidebarMenu className="p-2 pb-2">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/focus"}
                  tooltip="Focus"
                >
                  <Link
                    href="/focus"
                    onClick={() => {
                      handleMobileRouteIntent();
                    }}
                  >
                    <div className="flex items-center justify-center w-5 h-5 shrink-0">
                      <Timer className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <span>Focus</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/settings"}
                  tooltip="Settings"
                >
                  <Link
                    href="/settings"
                    onClick={() => {
                      handleMobileRouteIntent();
                    }}
                  >
                    <div className="flex items-center justify-center w-5 h-5 shrink-0">
                      <Settings className="h-4 w-4" strokeWidth={2.25} />
                    </div>
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}

          {!isMobile && hasChangelogUpdate && (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setChangelogOpen(true)}
                  tooltip="What's New"
                  className="text-foreground/70"
                >
                  <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                    <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                    <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                  </div>
                  <span>What&apos;s New</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}

          <div
            className={cn(
              "relative flex flex-col justify-center",
              isMobile ? "px-4 py-4 pt-2" : "h-[48px] px-4 py-3",
            )}
          >
            {!isMobile && (
              <div className="absolute inset-x-0 flex justify-center w-full transition-opacity duration-200 ease-seijaku group-data-[state=expanded]:opacity-0 group-data-[state=expanded]:pointer-events-none">
                <SidebarTrigger className="h-9 w-9 active:scale-95 transition-all" />
              </div>
            )}

            <div
              className={cn(
                "w-full transition-opacity duration-200 ease-seijaku",
                !isMobile &&
                  "group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:pointer-events-none flex flex-col gap-1.5",
              )}
            >
              {isMobile ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">
                      Build
                    </span>
                    {version.includes("preview") && (
                      <span className="px-1.5 py-0.5 rounded-md bg-brand/10 text-brand text-[9px] font-bold uppercase tracking-widest border border-brand/20 leading-none">
                        Preview
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] font-medium text-muted-foreground tracking-tight leading-none">
                    v{version}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none">
                      Build
                    </span>
                    {version.includes("preview") && (
                      <span className="px-1.5 py-0.5 rounded-md bg-brand/10 text-brand text-[9px] font-bold uppercase tracking-widest border border-brand/20 leading-none">
                        Preview
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] font-medium text-muted-foreground tracking-tight leading-none">
                    v{version}
                  </span>
                </>
              )}
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <ArchivedProjectsDialog
        open={isArchivedOpen}
        onOpenChange={setIsArchivedOpen}
      />

      {/* Mobile Project Action Drawer */}
      <Drawer
        open={!!mobileActionProject}
        onOpenChange={(open) => !open && setMobileActionProject(null)}
      >
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{mobileActionProject?.name}</DrawerTitle>
            <DrawerDescription>What would you like to do?</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pt-2">
            <DrawerClose asChild>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  trigger("toggle");
                  setMobileActionProject(null);
                  if (mobileActionProject) openEditProject(mobileActionProject);
                }}
              >
                Edit Project
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  trigger("thud");
                  setMobileActionProject(null);
                  if (mobileActionProject)
                    openDeleteProject(mobileActionProject);
                }}
              >
                Delete Project
              </Button>
            </DrawerClose>
            <DrawerClose asChild>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => trigger("tick")}
              >
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
