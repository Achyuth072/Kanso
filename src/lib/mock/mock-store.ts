/**
 * Mock Data Store for Guest Mode
 * Provides in-memory CRUD operations with localStorage persistence
 */

import type { Task, Project } from "@/lib/types/task";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import type { FocusLog } from "@/lib/types/focus";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type { BackupData } from "@/lib/backup/types";

const STORAGE_KEY = "kanso_guest_data_v8";

interface GuestData {
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  habit_entries: HabitEntry[];
  focus_logs: FocusLog[];
  events: CalendarEvent[];
  lastUpdated: string;
}

type BackupPayload = Omit<BackupData, "metadata">;

class MockStore {
  private data: GuestData;

  constructor() {
    const stored = this.loadFromStorage();
    if (stored) {
      this.data = stored;
    } else {
      this.data = this.getInitialData();
      this.saveToStorage();
    }
  }

  private getInitialData(): GuestData {
    const now = new Date();
    const nowIso = now.toISOString();
    const oneDay = 86400000;
    const startOfHistory = new Date(now.getTime() - 365 * oneDay)
      .toISOString()
      .split("T")[0];

    // Base Projects
    const pWork = "demo-project-work";
    const pPersonal = "demo-project-personal";
    const pSide = "demo-project-side";

    const projects: Project[] = [
      {
        id: pWork,
        user_id: "guest",
        name: "Work 💼",
        color: "#4B6CB7", // Kanso Blue
        view_style: "list",
        is_inbox: false,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: pPersonal,
        user_id: "guest",
        name: "Personal 🏠",
        color: "#839B82", // Muted Sage
        view_style: "list",
        is_inbox: false,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: pSide,
        user_id: "guest",
        name: "Side Hustle 🚀",
        color: "#8B6B80", // Plum
        view_style: "board",
        is_inbox: false,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    const tasks: Task[] = [];
    const logs: FocusLog[] = [];
    const habits: Habit[] = [];
    const entries: HabitEntry[] = [];
    const events: CalendarEvent[] = [];

    // Generators
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const createTask = (
      content: string,
      dayOffset: number,
      projectId: string,
      priority: 1 | 2 | 3 | 4 = 4,
      isEvening = false,
      parentId: string | null = null,
    ) => {
      const date = new Date(now.getTime() + dayOffset * oneDay);

      // Randomize start time
      const randomHour = isEvening
        ? 18 + Math.random() * 4 // 18:00 - 22:00
        : 8 + Math.random() * 6; // 08:00 - 14:00
      const randomMinute = Math.floor(Math.random() * 60);
      date.setHours(Math.floor(randomHour), randomMinute, 0, 0);

      const dueDate = date.toISOString();
      const isPast = dayOffset < 0;
      // 85% chance of completion if in past for "Deep Work", 60% for others
      const isCompleted =
        isPast && Math.random() > (content.includes("Deep Work") ? 0.15 : 0.4);

      const taskId = `task-${generateId()}`;

      tasks.push({
        id: taskId,
        user_id: "guest",
        content,
        description: null,
        is_completed: isCompleted,
        completed_at: isCompleted ? dueDate : null,
        priority,
        project_id: projectId,
        day_order: tasks.length,
        created_at: new Date(date.getTime() - 86400000).toISOString(),
        updated_at: dueDate,
        due_date: dueDate,
        do_date: null,
        is_evening: isEvening,
        parent_id: parentId,
        recurrence: null,
        google_event_id: null,
        google_etag: null,
      });

      // Add focus log if completed (simulate work done)
      if (isCompleted) {
        const durationSeconds = 900 + Math.floor(Math.random() * 7200); // 15m to 2h
        logs.push({
          id: `log-${generateId()}`,
          user_id: "guest",
          task_id: taskId,
          start_time: dueDate,
          end_time: new Date(
            date.getTime() + durationSeconds * 1000,
          ).toISOString(),
          duration_seconds: durationSeconds,
          created_at: dueDate,
        });
      }

      return taskId;
    };

    // Generate Past 365 Days (History for Stats)
    for (let i = -365; i < 0; i++) {
      const date = new Date(now.getTime() + i * oneDay);
      const dayOfWeek = date.getDay();
      const monthOffset = Math.abs(i) / 30;

      // Higher probability of activity overall to fill heatmap
      let probability = 0.8; // Boosted for positive stats
      if (monthOffset > 4) probability = 0.6;
      if (monthOffset > 8) probability = 0.45;

      // Special case: Very High density in the last 30 days
      if (Math.abs(i) <= 30) probability = 0.92;

      // Weekends still have less activity but not empty
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        probability *= 0.6; // More weekend work recorded
      }

      if (Math.random() > probability) continue;

      // On active days, generate 1-3 tasks, but more in recent month
      const maxTasks = Math.abs(i) <= 30 ? 6 : 3;
      const taskCount = Math.floor(Math.random() * maxTasks) + 1;
      for (let t = 0; t < taskCount; t++) {
        const isEvening = Math.random() > 0.7;
        createTask(
          t === 0
            ? "Deep Work Session"
            : Math.random() > 0.5
              ? "Review & Refactor"
              : "Learning & Research",
          i,
          isEvening ? pPersonal : pWork,
          (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3 | 4,
          isEvening,
        );
      }
    }

    // Generate Today & Future 30 Days
    for (let i = 0; i <= 30; i++) {
      // Today specific
      if (i === 0) {
        const parentId = createTask("Big Project Launch 🚀", 0, pWork, 1);
        createTask("Feature Cleanup", 0, pWork, 2, false, parentId);
        const subtaskId = createTask(
          "UI Polishing",
          0,
          pWork,
          3,
          false,
          parentId,
        );
        createTask("Typography refinement", 0, pWork, 3, false, subtaskId);
        createTask("Color palette audit", 0, pWork, 4, false, subtaskId);
        createTask("Mobile Testing", 0, pWork, 2, false, parentId);

        createTask("Review PRs", 0, pWork, 1);
        createTask("Team Sync", 0, pWork, 2);
        createTask("Call Mom", 0, pPersonal, 3, true);
        createTask("Workout @ Gym", 0, pPersonal, 2);
        createTask("Grocery Shopping", 0, pPersonal, 4);
        createTask("Water Plants", 0, pPersonal, 4, true);
        continue;
      }

      // Random high density days in the next 30 days
      const isHighDensity = Math.random() > 0.8;
      const count = isHighDensity ? 7 : Math.random() > 0.4 ? 2 : 0;

      for (let t = 0; t < count; t++) {
        createTask(
          t % 2 === 0 ? "Project Task" : "Personal Goal",
          i,
          t % 2 === 0 ? pWork : pPersonal,
          (Math.floor(Math.random() * 3) + 1) as 1 | 2 | 3 | 4,
          Math.random() > 0.7,
        );
      }

      if (i % 3 === 0) createTask("Write Blog Post", i, pSide, 2);
      if (i % 7 === 0) createTask("Weekly Planning", i, pPersonal, 1);
    }

    // Generate Habits
    const hWater = "habit-water";
    const hExercise = "habit-exercise";
    const hRead = "habit-read";

    habits.push(
      {
        id: hWater,
        user_id: "guest",
        name: "Drink Water 💧",
        description: "8 glasses a day",
        color: "#5B7C99", // Earthy Blue
        icon: "Droplet",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
      },
      {
        id: hExercise,
        user_id: "guest",
        name: "Morning Exercise 🏃‍♂️",
        description: "30 mins activity",
        color: "#A3B18A", // Muted Mint
        icon: "Dumbbell",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
      },
      {
        id: hRead,
        user_id: "guest",
        name: "Read 📚",
        description: "20 pages",
        color: "#9F8189", // Lavender
        icon: "Book",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
      },
    );

    // Generate Habit Entries for the last 365 days
    for (let i = -365; i <= 0; i++) {
      const date = new Date(now.getTime() + i * oneDay);
      const dateStr = date.toISOString().split("T")[0];

      // Drink Water: 95% completion
      if (Math.random() < 0.95) {
        entries.push({
          id: `entry-${generateId()}`,
          habit_id: hWater,
          date: dateStr,
          value: 1,
          created_at: nowIso,
        });
      }

      // Exercise: 75% completion, higher on weekdays
      const dayOfWeek = date.getDay();
      const exerciseProb = dayOfWeek === 0 || dayOfWeek === 6 ? 0.5 : 0.85;
      if (Math.random() < exerciseProb) {
        entries.push({
          id: `entry-${generateId()}`,
          habit_id: hExercise,
          date: dateStr,
          value: 1,
          created_at: nowIso,
        });
      }

      // Read: 65% completion
      if (Math.random() < 0.65) {
        entries.push({
          id: `entry-${generateId()}`,
          habit_id: hRead,
          date: dateStr,
          value: 1,
          created_at: nowIso,
        });
      }
    }

    // Generate Mock Events (Past and Future)
    const mockLocations = ["Coffee Shop", "Office", "Zoom", "Gym", "Home"];
    for (let i = -7; i <= 14; i++) {
      const date = new Date(now.getTime() + i * oneDay);
      // Add random event
      if (Math.random() > 0.4) {
        const randomHour = 9 + Math.floor(Math.random() * 8); // 9am to 4pm
        const startTime = new Date(date);
        startTime.setHours(randomHour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + 3600000); // 1 hour

        const id = `event-${generateId()}`;
        events.push({
          id,
          user_id: "guest",
          title: i === 0 ? "Team Catch Up" : `Meeting ${id}`,
          description: "Mock event generated for guest mode",
          location:
            Math.random() > 0.5
              ? mockLocations[Math.floor(Math.random() * mockLocations.length)]
              : null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          all_day: false,
          color: "#4B6CB7", // Kanso brand
          category: "event",
          recurrence_rule: null,
          remote_id: null,
          remote_calendar_id: null,
          etag: null,
          ics_uid: null,
          is_archived: false,
          metadata: {},
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    return {
      tasks,
      projects,
      habits,
      habit_entries: entries,
      focus_logs: logs,
      events,
      lastUpdated: nowIso,
    };
  }

  private loadFromStorage(): GuestData | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined") return;

    try {
      this.data.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn("Failed to save guest data to localStorage:", error);
    }
  }

  // Task Operations
  getTasks(): Task[] {
    return this.data.tasks;
  }

  getTask(id: string): Task | null {
    return this.data.tasks.find((t) => t.id === id) || null;
  }

  addTask(
    task: Partial<
      Omit<Task, "id" | "user_id" | "created_at" | "updated_at">
    > & {
      content: string;
      id?: string;
    },
  ): Task {
    const now = new Date().toISOString();
    const newTask: Task = {
      project_id: task.project_id ?? null,
      parent_id: task.parent_id ?? null,
      description: task.description ?? null,
      priority: task.priority ?? 4,
      due_date: task.due_date ?? null,
      do_date: task.do_date ?? null,
      is_evening: task.is_evening ?? false,
      is_completed: task.is_completed ?? false,
      completed_at: task.completed_at ?? null,
      day_order: task.day_order ?? this.data.tasks.length,
      recurrence: task.recurrence ?? null,
      google_event_id: task.google_event_id ?? null,
      google_etag: task.google_etag ?? null,
      content: task.content,
      id:
        task.id ||
        `guest-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
    };

    this.data.tasks = [...this.data.tasks, newTask];
    this.saveToStorage();
    return newTask;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const index = this.data.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const updatedTasks = [...this.data.tasks];
    updatedTasks[index] = {
      ...updatedTasks[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.tasks = updatedTasks;

    this.saveToStorage();
    return this.data.tasks[index];
  }

  deleteTask(id: string): boolean {
    const index = this.data.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;

    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    this.saveToStorage();
    return true;
  }

  // Project Operations
  getProjects(): Project[] {
    return this.data.projects;
  }

  getProject(id: string): Project | null {
    return this.data.projects.find((p) => p.id === id) || null;
  }

  addProject(
    project: Omit<Project, "id" | "user_id" | "created_at" | "updated_at">,
  ): Project {
    const now = new Date().toISOString();
    const newProject: Project = {
      ...project,
      id: `guest-project-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
    };

    this.data.projects = [...this.data.projects, newProject];
    this.saveToStorage();
    return newProject;
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const index = this.data.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updatedProjects = [...this.data.projects];
    updatedProjects[index] = {
      ...updatedProjects[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.projects = updatedProjects;

    this.saveToStorage();
    return this.data.projects[index];
  }

  deleteProject(id: string): boolean {
    const index = this.data.projects.findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    this.saveToStorage();
    return true;
  }

  moveTasksToInbox(projectId: string): void {
    let changed = false;
    this.data.tasks = this.data.tasks.map((t) => {
      if (t.project_id === projectId) {
        changed = true;
        return {
          ...t,
          project_id: null,
          updated_at: new Date().toISOString(),
        };
      }
      return t;
    });
    if (changed) this.saveToStorage();
  }

  deleteTasksByProject(projectId: string): void {
    const initialLength = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((t) => t.project_id !== projectId);
    if (this.data.tasks.length !== initialLength) {
      this.saveToStorage();
    }
  }

  // Focus Logs
  getFocusLogs(): FocusLog[] {
    return this.data.focus_logs || [];
  }

  addFocusLog(log: Omit<FocusLog, "id" | "created_at">): FocusLog {
    const now = new Date().toISOString();
    const newLog: FocusLog = {
      ...log,
      id: `guest-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: now,
    };

    if (!this.data.focus_logs) this.data.focus_logs = [];
    this.data.focus_logs = [...this.data.focus_logs, newLog];
    this.saveToStorage();
    return newLog;
  }

  // Habit Operations
  getHabits(): Habit[] {
    return this.data.habits || [];
  }

  getHabitEntries(habitId?: string): HabitEntry[] {
    if (!this.data.habit_entries) return [];
    if (habitId) {
      return this.data.habit_entries.filter((e) => e.habit_id === habitId);
    }
    return this.data.habit_entries;
  }

  addHabit(
    habit: Omit<Habit, "id" | "user_id" | "created_at" | "updated_at">,
  ): Habit {
    const now = new Date().toISOString();
    const newHabit: Habit = {
      ...habit,
      id: `guest-habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
      start_date: habit.start_date || now.split("T")[0],
    };

    if (!this.data.habits) this.data.habits = [];
    this.data.habits = [...this.data.habits, newHabit];
    this.saveToStorage();
    return newHabit;
  }

  updateHabit(id: string, updates: Partial<Habit>): Habit | null {
    const index = this.data.habits.findIndex((h) => h.id === id);
    if (index === -1) return null;

    const updatedHabits = [...this.data.habits];
    updatedHabits[index] = {
      ...updatedHabits[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.habits = updatedHabits;

    this.saveToStorage();
    return this.data.habits[index];
  }

  deleteHabit(id: string): boolean {
    const index = this.data.habits.findIndex((h) => h.id === id);
    if (index === -1) return false;

    this.data.habits = this.data.habits.filter((h) => h.id !== id);
    // Also delete entries
    this.data.habit_entries = this.data.habit_entries.filter(
      (e) => e.habit_id !== id,
    );

    this.saveToStorage();
    return true;
  }

  toggleHabitEntry(habitId: string, date: string): HabitEntry | null {
    const existingIndex = this.data.habit_entries.findIndex(
      (e) => e.habit_id === habitId && e.date === date,
    );

    if (existingIndex !== -1) {
      // Remove entry
      this.data.habit_entries = this.data.habit_entries.filter(
        (_, i) => i !== existingIndex,
      );
      this.saveToStorage();
      return null;
    } else {
      // Add entry
      const newEntry: HabitEntry = {
        id: `guest-entry-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        habit_id: habitId,
        date,
        value: 1,
        created_at: new Date().toISOString(),
      };
      this.data.habit_entries = [...this.data.habit_entries, newEntry];
      this.saveToStorage();
      return newEntry;
    }
  }

  // Event Operations
  getEvents(): CalendarEvent[] {
    return this.data.events || [];
  }

  addEvent(
    event: Omit<CalendarEvent, "id" | "user_id" | "created_at" | "updated_at">,
  ): CalendarEvent {
    const now = new Date().toISOString();
    const newEvent: CalendarEvent = {
      ...event,
      id: `guest-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
    };

    if (!this.data.events) this.data.events = [];
    this.data.events = [...this.data.events, newEvent];
    this.saveToStorage();
    return newEvent;
  }

  updateEvent(
    id: string,
    updates: Partial<CalendarEvent>,
  ): CalendarEvent | null {
    const index = this.data.events?.findIndex((e) => e.id === id) ?? -1;
    if (index === -1) return null;

    const updatedEvents = [...this.data.events];
    updatedEvents[index] = {
      ...updatedEvents[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.events = updatedEvents;

    this.saveToStorage();
    return this.data.events[index];
  }

  deleteEvent(id: string): boolean {
    const index = this.data.events?.findIndex((e) => e.id === id) ?? -1;
    if (index === -1) return false;

    this.data.events = this.data.events.filter((e) => e.id !== id);
    this.saveToStorage();
    return true;
  }

  // Backup Restore Operations (preserve IDs and timestamps)
  restoreProject(project: Project): void {
    this.data.projects.push(project);
    this.saveToStorage();
  }

  restoreTask(task: Task): void {
    this.data.tasks.push(task);
    this.saveToStorage();
  }

  restoreHabit(habit: Habit): void {
    if (!this.data.habits) this.data.habits = [];
    this.data.habits.push(habit);
    this.saveToStorage();
  }

  restoreEvent(event: CalendarEvent): void {
    if (!this.data.events) this.data.events = [];
    this.data.events.push(event);
    this.saveToStorage();
  }

  restoreFocusLog(log: FocusLog): void {
    if (!this.data.focus_logs) this.data.focus_logs = [];
    this.data.focus_logs.push(log);
    this.saveToStorage();
  }

  restoreBackup(data: BackupPayload): void {
    this.data = {
      tasks: [...(data.tasks || [])],
      projects: [...(data.projects || [])],
      habits: [...(data.habits || [])],
      habit_entries: [...(data.habit_entries || [])],
      focus_logs: [...(data.focus_logs || [])],
      events: [...(data.events || [])],
      lastUpdated: new Date().toISOString(),
    };

    this.saveToStorage();
  }

  addHabitEntry(entry: HabitEntry): void {
    if (!this.data.habit_entries) this.data.habit_entries = [];
    this.data.habit_entries.push(entry);
    this.saveToStorage();
  }

  // Utility
  reset(): void {
    this.data = this.getInitialData();
    this.saveToStorage();
  }

  clearData(): void {
    this.data = {
      tasks: [],
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
      events: [],
      lastUpdated: new Date().toISOString(),
    };
    this.saveToStorage();
  }

  clearStorage(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

// Singleton instance
export const mockStore = new MockStore();
