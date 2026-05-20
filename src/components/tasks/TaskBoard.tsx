"use client";

import React, {
  useMemo,
  useCallback,
  useState,
  memo,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  MeasuringStrategy,
  DragOverEvent,
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  rectIntersection,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useJsLoaded } from "@/lib/hooks/use-js-loaded";
import type { ProcessedTasks, TaskGroup } from "@/lib/hooks/useTaskViewData";
import type { Task, Project } from "@/lib/types/task";
import { SortableBoardTaskCard } from "./SortableBoardTaskCard";
import { TaskGhost } from "./TaskGhost";
import { useUpdateTask, useReorderTasks } from "@/lib/hooks/useTaskMutations";
import { useUiStore } from "@/lib/store/uiStore";
import { KanbanBoardProvider } from "@/components/kanban";
import {
  getTaskUpdatesForGroup,
  computeReorderPairs,
} from "@/lib/utils/task-dnd";

interface TaskBoardProps {
  processedTasks: ProcessedTasks;
  projectsMap: Map<string, Project>;
  onSelect?: (task: Task) => void;
  isDesktop: boolean;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  startTimer: (taskId: string) => void;
}

export function TaskBoard({
  processedTasks,
  projectsMap = new Map(),
  onSelect,
  isDesktop,
  triggerHaptic,
  startTimer,
}: TaskBoardProps) {
  const isJsLoaded = useJsLoaded();
  const { groups, active, evening } = processedTasks;
  const updateTaskMutation = useUpdateTask();
  const reorderMutation = useReorderTasks();
  const sortBy = useUiStore((state) => state.sortBy);
  const setSortBy = useUiStore((state) => state.setSortBy);

  const [activeId, setActiveId] = useState<string | null>(null);
  // Mirrors the list-view lockLocal pattern: while lockLocal=true (or activeId
  // is set), displayColumns reads from localColumns (local drag state) rather
  // than boardColumns (server-derived). The inline ternary is evaluated
  // synchronously in the render body — no useEffect race window.
  const [lockLocal, setLockLocal] = useState(false);
  // When a cross-column drop fires both updateMutation and reorderMutation,
  // reorderMutation often settles first → invalidateQueries → a background
  // refetch returns stale server data (before updateMutation commits) →
  // boardColumns briefly has the task in the old column. If we released
  // lockLocal immediately when pendingCount hits 0, displayColumns would
  // switch to this stale boardColumns → snap-back. Instead, we defer the
  // release until boardColumns actually reflects the expected destination.
  const [pendingLockRelease, setPendingLockRelease] = useState<{
    taskId: string;
    columnTitle: string;
  } | null>(null);

  // Captures the flat task list at drag-start time. Used by computeReorderPairs
  // to find the server-authoritative day_order values of the slots being reordered,
  // without requiring access to the query client inside a component.
  const preDragFlatTasksRef = useRef<Task[]>([]);

  const boardColumns = useMemo<TaskGroup[]>(() => {
    if (groups && groups.length > 0) return groups;
    return [
      { title: "Tasks", tasks: active },
      { title: "This Evening", tasks: evening },
    ].filter((c) => c.tasks.length > 0);
  }, [groups, active, evening]);

  const [localColumns, setLocalColumns] = useState<TaskGroup[]>(boardColumns);

  // Inline gate: while dragging (activeId set) or locked (lockLocal), show the
  // local drag state; otherwise show the server-authoritative boardColumns.
  // Evaluated synchronously in the render body — no extra render cycle,
  // no race window between a prop update and a useEffect firing.
  // This mirrors TaskList.tsx's (activeId || lockLocal) ? localActive : processedTasks.active.
  const displayColumns = activeId || lockLocal ? localColumns : boardColumns;

  // Keep localColumns in sync between drags so handleDragStart has a fresh base.
  useEffect(() => {
    if (!activeId && !lockLocal) {
      setLocalColumns(boardColumns);
    }
  }, [boardColumns, activeId, lockLocal]);

  // Deferred lock release: only switch displayColumns → boardColumns once
  // boardColumns actually contains the dragged task in the expected destination
  // column. This prevents the snap-back caused by a stale invalidateQueries
  // refetch completing before the property updateMutation commits to the server.
  useEffect(() => {
    if (!pendingLockRelease) return;
    const taskInColumn = boardColumns
      .find((col) => col.title === pendingLockRelease.columnTitle)
      ?.tasks.some((t) => t.id === pendingLockRelease.taskId);
    if (taskInColumn) {
      setLockLocal(false);
      setPendingLockRelease(null);
    }
  }, [boardColumns, pendingLockRelease]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const getTaskUpdates = useCallback(
    (groupTitle: string) => getTaskUpdatesForGroup(groupTitle, projectsMap),
    [projectsMap],
  );

  const handleDragStart = (event: DragStartEvent) => {
    // 🚀 Performance: Sync local state only when drag starts
    setLocalColumns(boardColumns);
    setActiveId(event.active.id as string);
    // Capture the server-authoritative flat task list before any local reorder
    // mutations. This snapshot is used in handleDragEnd to compute correct
    // slot-value-swap day_order pairs via computeReorderPairs.
    preDragFlatTasksRef.current = boardColumns
      .flatMap((col) => col.tasks)
      .sort((a, b) => a.day_order - b.day_order);
    triggerHaptic?.("toggle");
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumn = localColumns.find((col) =>
      col.tasks.some((t) => t.id === activeId),
    );
    const overColumn =
      localColumns.find((col) => col.tasks.some((t) => t.id === overId)) ||
      localColumns.find((col) => col.title === overId);

    if (!activeColumn || !overColumn) return;

    if (activeColumn.title !== overColumn.title) {
      setLocalColumns((prev) => {
        const activeColIndex = prev.findIndex(
          (c) => c.title === activeColumn.title,
        );
        const overColIndex = prev.findIndex(
          (c) => c.title === overColumn.title,
        );

        const activeTasks = [...prev[activeColIndex].tasks];
        const overTasks = [...prev[overColIndex].tasks];

        const activeIndex = activeTasks.findIndex((t) => t.id === activeId);
        if (activeIndex === -1) return prev;

        // FIX: Use dnd-kit's provided index for reliable positioning
        let overIndex = over.data?.current?.sortable?.index;
        if (overIndex === undefined) {
          // Fallback to findIndex if dnd-kit doesn't provide it
          overIndex = overTasks.findIndex((t) => t.id === overId);
        }

        const [movedTask] = activeTasks.splice(activeIndex, 1);

        // Apply property updates when moving between columns
        const updates = getTaskUpdates(overColumn.title);
        const updatedTask = { ...movedTask, ...updates };

        let newIndex;
        if (overId === overColumn.title) {
          newIndex = overTasks.length;
        } else {
          newIndex = overIndex >= 0 ? overIndex : overTasks.length;
        }

        overTasks.splice(newIndex, 0, updatedTask);

        const newCols = [...prev];
        newCols[activeColIndex] = {
          ...prev[activeColIndex],
          tasks: activeTasks,
        };
        newCols[overColIndex] = { ...prev[overColIndex], tasks: overTasks };
        return newCols;
      });
    } else {
      // Reordering within the same column.
      // newIndex comes from dnd-kit's event (DOM-based, not React state).
      // All other computation happens inside the functional updater so the
      // closure never captures stale localColumns — every reference reads
      // directly from prev, which is the latest committed state.
      const dndNewIndex = over.data?.current?.sortable?.index;

      setLocalColumns((prev) => {
        const colIndex = prev.findIndex((c) => c.title === activeColumn.title);
        if (colIndex === -1) return prev;

        const prevTasks = [...prev[colIndex].tasks];
        const oldIndex = prevTasks.findIndex((t) => t.id === activeId);
        if (oldIndex === -1) return prev;

        // Use dnd-kit's provided index for reliable positioning
        let newIndex = dndNewIndex;
        if (newIndex === undefined) {
          // Fallback to findIndex from prev state
          newIndex = prevTasks.findIndex((t) => t.id === overId);
        }
        if (newIndex === undefined || newIndex === -1) return prev;

        const newCols = [...prev];
        newCols[colIndex] = {
          ...prev[colIndex],
          tasks: arrayMove(prevTasks, oldIndex, newIndex),
        };
        return newCols;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Dropped outside any droppable — just clear activeId.
    // displayColumns falls through to boardColumns when activeId=null && lockLocal=false.
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const finalColumn = localColumns.find((col) =>
      col.tasks.some((t) => t.id === activeId),
    );
    // Early-return BEFORE clearing activeId so we never enter a render with
    // activeId=null && lockLocal=false (which would let displayColumns fall
    // through to boardColumns before the drop position is committed).
    if (!finalColumn) {
      setActiveId(null);
      return;
    }
    const activeTask = finalColumn.tasks.find((t) => t.id === activeId);
    if (!activeTask) {
      setActiveId(null);
      return;
    }

    // CRITICAL ORDERING: setLockLocal(true) MUST be queued BEFORE setActiveId(null).
    // React 18 batches both into one render, but ordering defends against any
    // partial-flush scenario (dnd-kit useReducer + React Compiler). While
    // lockLocal=true, displayColumns reads localColumns (new order) — not
    // boardColumns — so no stale server state can overwrite the drop position.
    setLockLocal(true);
    if (sortBy !== "custom") setSortBy("custom");

    // 1. Commit property updates (if any)
    const updates = getTaskUpdates(finalColumn.title);
    const originalTask =
      processedTasks.active.find((t) => t.id === activeId) ||
      processedTasks.evening.find((t) => t.id === activeId);

    // Check if properties actually changed
    const hasChanged =
      originalTask &&
      Object.keys(updates).some(
        (key) =>
          (updates as Record<string, unknown>)[key] !==
          (originalTask as unknown as Record<string, unknown>)[key],
      );

    // Each mutation that fires increments pendingCount. For cross-column drops
    // (hasChanged=true), the lock is released via deferred release — we wait
    // until boardColumns actually reflects the destination column before calling
    // setLockLocal(false). For same-column reorders (hasChanged=false/undefined),
    // the lock releases immediately when pendingCount hits 0.
    let pendingCount = 0;
    const tryReleaseLock = () => {
      pendingCount--;
      if (pendingCount <= 0) {
        if (hasChanged) {
          setPendingLockRelease({
            taskId: activeId,
            columnTitle: finalColumn.title,
          });
        } else {
          setLockLocal(false);
        }
      }
    };

    if (hasChanged) {
      pendingCount++;
      updateTaskMutation.mutate(
        { id: activeId, ...updates },
        {
          onSettled: tryReleaseLock,
        },
      );
    }

    // 2. Commit reorder using slot-value-swap day_order pairs.
    // preDragFlatTasksRef.current holds the server-authoritative flat task list
    // captured at handleDragStart — BEFORE any local reorder mutations.
    // lockLocal is released via tryReleaseLock once all mutations settle.
    const orderedIds = finalColumn.tasks.map((t) => t.id);
    const pairs = computeReorderPairs(orderedIds, preDragFlatTasksRef.current);
    pendingCount++;
    reorderMutation.mutate(pairs, {
      onSettled: tryReleaseLock,
    });
    triggerHaptic?.("thud");
    setActiveId(null);
  };

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    return (
      localColumns.flatMap((c) => c.tasks).find((t) => t.id === activeId) ||
      null
    );
  }, [activeId, localColumns]);

  if (!isJsLoaded) return null;

  return (
    <KanbanBoardProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
        autoScroll={{
          layoutShiftCompensation: false,
          threshold: {
            x: 0.1,
            y: 0.1,
          },
          acceleration: 10,
        }}
      >
        <div
          className="flex items-start h-full overflow-x-auto pb-12 md:pb-6 px-4 md:px-6 gap-6 snap-x snap-mandatory scrollbar-hide"
          data-testid="task-board-container"
        >
          {displayColumns.map((group) => (
            <KanbanColumn
              key={group.title}
              group={group}
              projectsMap={projectsMap}
              isDesktop={isDesktop}
              onSelect={onSelect}
              startTimer={startTimer}
              triggerHaptic={triggerHaptic}
              isDndActive={!!activeId}
            />
          ))}
        </div>

        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay
              // dropAnimation duration is 0 here (matching TaskList) to
              // eliminate the residual "overlay animates to original
              // position then snaps to new" glitch. The drop animation
              // measures the active node's DOM rect AFTER React renders
              // the post-drop state, but BEFORE the optimistic cache
              // update from React Query's async onMutate has propagated.
              // When duration is 0, dnd-kit short-circuits the animation
              // entirely (see createDefaultDropAnimation: `if (!duration)
              // return`), so the overlay simply disappears at the same
              // instant the source item snaps into place — which is
              // already in the correct (new) position because displayColumns
              // is gated by lockLocal until onSettled fires.
              dropAnimation={{
                duration: 0,
                sideEffects: defaultDropAnimationSideEffects({
                  styles: {
                    active: { opacity: "0.5" },
                  },
                }),
              }}
            >
              {activeTask ? (
                <div className="opacity-90 pointer-events-none will-change-transform rotate-1 scale-[1.02]">
                  <TaskGhost
                    task={activeTask}
                    isDesktop={isDesktop}
                    viewMode="board"
                    project={projectsMap?.get?.(
                      activeTask.project_id || "inbox",
                    )}
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>
    </KanbanBoardProvider>
  );
}

const KanbanColumn = memo(function KanbanColumn({
  group,
  projectsMap,
  isDesktop,
  onSelect,
  startTimer,
  triggerHaptic,
  isDndActive,
}: {
  group: TaskGroup;
  projectsMap: Map<string, Project>;
  isDesktop: boolean;
  onSelect?: (task: Task) => void;
  startTimer: (taskId: string) => void;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  isDndActive: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: group.title });

  return (
    <section
      ref={setNodeRef}
      className="w-[85vw] md:w-[320px] snap-center bg-sidebar border border-border rounded-2xl flex flex-col p-0.5 max-h-[calc(100vh-200px)] md:max-h-full"
    >
      <div className="px-3 py-2.5 flex items-center justify-between">
        <h3 className="type-h3 lowercase tracking-tight text-foreground/70">
          {group.title}
          <span className="ml-2 text-[11px] font-bold opacity-40 tabular-nums">
            {group.tasks.length}
          </span>
        </h3>
      </div>

      <SortableContext
        items={group.tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="px-3 pb-4 space-y-3 flex-1 overflow-y-auto scrollbar-hide">
          {group.tasks.map((task) => (
            <TaskCardWrapper
              key={task.id}
              task={task}
              project={projectsMap.get(task.project_id || "inbox")}
              isDesktop={isDesktop}
              onSelect={onSelect}
              startTimer={startTimer}
              triggerHaptic={triggerHaptic}
              _isDndActive={isDndActive}
            />
          ))}
          {group.tasks.length === 0 && (
            <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/30 rounded-2xl opacity-40">
              <span className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                Ma (Void)
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
});

const TaskCardWrapper = memo(function TaskCardWrapper({
  task,
  project,
  isDesktop,
  onSelect,
  startTimer,
  triggerHaptic,
  _isDndActive,
}: {
  task: Task;
  project: Project | undefined;
  isDesktop: boolean;
  onSelect?: (task: Task) => void;
  startTimer: (taskId: string) => void;
  triggerHaptic: (signature?: "tick" | "toggle" | "thud" | "success") => void;
  _isDndActive: boolean;
}) {
  return (
    <SortableBoardTaskCard
      task={task}
      project={
        project ? { color: project.color, name: project.name } : undefined
      }
      isDesktop={isDesktop}
      onSelect={onSelect}
      triggerHaptic={triggerHaptic}
      startTimer={startTimer}
    />
  );
});
