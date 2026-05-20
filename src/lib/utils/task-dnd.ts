import { addDays, format } from "date-fns";
import type { Task, Project } from "@/lib/types/task";

/**
 * Calculates the properties to update when a task is moved to a specific group/column.
 */
export function getTaskUpdatesForGroup(
  groupTitle: string,
  projectsMap: Map<string, Project>,
): Partial<Task> {
  let updates: Partial<Task> = {};
  const today = new Date();
  const groupKey = groupTitle.toLowerCase();

  if (groupKey === "today") {
    const d = format(today, "yyyy-MM-dd");
    updates = { do_date: d, due_date: d };
  } else if (groupKey === "tomorrow") {
    const d = format(addDays(today, 1), "yyyy-MM-dd");
    updates = { do_date: d, due_date: d };
  } else if (groupKey === "upcoming") {
    const d = format(addDays(today, 2), "yyyy-MM-dd");
    updates = { do_date: d, due_date: d };
  } else if (groupKey === "overdue") {
    updates = {};
  } else if (groupKey === "no date") {
    updates = { do_date: null, due_date: null };
  } else if (groupKey === "this evening") {
    updates = { is_evening: true };
  } else if (groupKey === "active" || groupKey === "tasks") {
    updates = { is_evening: false };
  } else if (groupKey === "critical") {
    updates = { priority: 1 };
  } else if (groupKey === "high") {
    updates = { priority: 2 };
  } else if (groupKey === "medium") {
    updates = { priority: 3 };
  } else if (groupKey === "low") {
    updates = { priority: 4 };
  } else if (groupKey === "inbox") {
    updates = { project_id: null };
  } else {
    // Find project by name in the map
    for (const p of projectsMap.values()) {
      if (p.name.toLowerCase() === groupKey) {
        updates = { project_id: p.id };
        break;
      }
    }
  }
  return updates;
}

/**
 * Computes {id, day_order} pairs for a reorder operation using slot-value-swap.
 *
 * The slot-value-swap algorithm assigns each task in the new order the day_order
 * value from the cache slot it is moving INTO — not a fresh sequential 0,1,2...
 * This keeps the global flat cache stable across all sections/groups after the
 * server responds, preventing cross-section interleaving.
 *
 * How it works:
 *   - Find the flat-array positions (slots) where the reordered tasks appear
 *     in the CURRENT authoritative flat list (pre-drag order).
 *   - Collect the day_order values at those slots (slot_day_orders).
 *   - Assign: orderedIds[i].day_order = slot_day_orders[i]
 *
 * The set of day_order values in the affected slots stays constant — only which
 * task holds which value changes. Tasks outside orderedIds are never touched.
 *
 * @param orderedIds  Task IDs in the desired new order (one section/group only).
 * @param flatTasks   The server-authoritative flat task list (pre-drag).
 *                    In list view this is the raw tasks from useTasks.
 *                    In board view this is captured at handleDragStart.
 */
export function computeReorderPairs(
  orderedIds: string[],
  flatTasks: Task[],
): { id: string; day_order: number }[] {
  const reorderedIdSet = new Set(orderedIds);

  // Collect slot positions in flat order (maintains original relative sequence)
  const slots: number[] = [];
  for (let i = 0; i < flatTasks.length; i++) {
    if (reorderedIdSet.has(flatTasks[i].id)) {
      slots.push(i);
    }
  }

  // Extract day_order values from the slots (pre-drag values at each slot position)
  const slotDayOrders = slots.map((slotIdx) => flatTasks[slotIdx].day_order);

  // Check if slot day_orders are strictly monotonically increasing.
  // When they're not (e.g., all 0 from the DB default, or ties exist),
  // swapping produces duplicate values the server can't distinguish —
  // it falls back to created_at order, causing snap-back.
  // In that case, use the slot indices as day_order values instead.
  // Slot indices are always unique and ascending.
  let isStrictlyIncreasing = true;
  for (let i = 1; i < slotDayOrders.length; i++) {
    if (slotDayOrders[i] <= slotDayOrders[i - 1]) {
      isStrictlyIncreasing = false;
      break;
    }
  }

  const effectiveDayOrders = isStrictlyIncreasing ? slotDayOrders : slots;

  // Map each task in new order to the day_order of the slot it is moving into.
  // If a task ID is not found in flatTasks (e.g. a freshly optimistic task that
  // hasn't synced yet), fall back to sequential index to avoid gaps.
  return orderedIds.map((id, i) => ({
    id,
    day_order: effectiveDayOrders[i] ?? i,
  }));
}
