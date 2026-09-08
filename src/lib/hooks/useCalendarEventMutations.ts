"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { calendarEventMutations } from "@/lib/mutations/calendar-event";
import { useCalendarStore } from "@/lib/calendar/store";
import { notifyLocalEdit } from "@/lib/sync/sync-scheduler";
import { handleMutationError } from "@/lib/utils/mutation-error";
import { toCalendarEventUI } from "@/lib/types/calendar-event";
import type {
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  CalendarEvent,
} from "@/lib/types/calendar-event";

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  const addEvent = useCalendarStore((state) => state.addEvent);

  return useMutation({
    mutationFn: (input: CreateCalendarEventInput) =>
      calendarEventMutations.create(input),
    onSuccess: (data: CalendarEvent) => {
      addEvent(toCalendarEventUI(data));
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      notifyLocalEdit();
    },
    onError: (err) => {
      handleMutationError(err);
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  const updateEvent = useCalendarStore((state) => state.updateEvent);

  return useMutation({
    mutationFn: (input: UpdateCalendarEventInput) =>
      calendarEventMutations.update(input),
    onSuccess: (data: CalendarEvent) => {
      const uiEvent = toCalendarEventUI(data);
      updateEvent(data.id, uiEvent);
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      notifyLocalEdit();
    },
    onError: (err) => {
      handleMutationError(err);
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  const deleteEvent = useCalendarStore((state) => state.deleteEvent);

  return useMutation({
    mutationFn: (id: string) => calendarEventMutations.delete(id),
    onSuccess: (_, id) => {
      deleteEvent(id);
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      notifyLocalEdit();
    },
    onError: (err) => {
      handleMutationError(err);
    },
  });
}
