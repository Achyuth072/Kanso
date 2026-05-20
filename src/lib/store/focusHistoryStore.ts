"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FocusSession {
  id: string;
  taskId: string | null;
  duration: number; // in seconds
  completedAt: string; // ISO date string
}

interface FocusHistoryState {
  sessions: FocusSession[];
  addSession: (session: Omit<FocusSession, "id">) => void;
  clearHistory: () => void;
}

export const useFocusHistoryStore = create<FocusHistoryState>()(
  persist(
    (set) => ({
      sessions: [],
      addSession: (session) =>
        set((state) => ({
          sessions: [
            ...state.sessions,
            {
              ...session,
              id: crypto.randomUUID(),
            },
          ],
        })),
      clearHistory: () => set({ sessions: [] }),
    }),
    {
      name: "kanso-focus-history",
    },
  ),
);
