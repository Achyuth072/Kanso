"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { taskMutations } from "@/lib/mutations/task";
import { habitMutations } from "@/lib/mutations/habit";
import { projectMutations } from "@/lib/mutations/project";
import { focusMutations } from "@/lib/mutations/focus";

const asyncStoragePersister = {
  persistClient: async (client: unknown) => {
    await set("REACT_QUERY_OFFLINE_CACHE", client);
  },
  restoreClient: async () => {
    return await get("REACT_QUERY_OFFLINE_CACHE");
  },
  removeClient: async () => {
    await del("REACT_QUERY_OFFLINE_CACHE");
  },
};

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days for offline
          retry: 2,
          refetchOnWindowFocus: true,
          networkMode: "offlineFirst",
        },
        mutations: {
          retry: 1,
        },
      },
    });

    // Register defaults for resumable mutations
    // Tasks
    client.setMutationDefaults(["createTask"], {
      mutationFn: taskMutations.create,
    });
    client.setMutationDefaults(["toggleTask"], {
      mutationFn: taskMutations.toggle,
    });
    client.setMutationDefaults(["updateTask"], {
      mutationFn: taskMutations.update,
    });
    client.setMutationDefaults(["deleteTask"], {
      mutationFn: taskMutations.delete,
    });
    client.setMutationDefaults(["reorderTasks"], {
      mutationFn: taskMutations.reorder,
    });
    client.setMutationDefaults(["clearCompletedTasks"], {
      mutationFn: taskMutations.clearCompleted,
    });

    // Habits
    client.setMutationDefaults(["createHabit"], {
      mutationFn: habitMutations.create,
    });
    client.setMutationDefaults(["updateHabit"], {
      mutationFn: habitMutations.update,
    });
    client.setMutationDefaults(["deleteHabit"], {
      mutationFn: habitMutations.delete,
    });
    client.setMutationDefaults(["markHabitComplete"], {
      mutationFn: habitMutations.markComplete,
    });

    // Projects
    client.setMutationDefaults(["createProject"], {
      mutationFn: projectMutations.create,
    });
    client.setMutationDefaults(["updateProject"], {
      mutationFn: projectMutations.update,
    });
    client.setMutationDefaults(["archiveProject"], {
      mutationFn: projectMutations.archive,
    });

    // Focus
    client.setMutationDefaults(["logFocusSession"], {
      mutationFn: focusMutations.logSession,
    });

    return client;
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      }}
      onSuccess={() => {
        // Authenticated Session Guard
        const supabase = createClient();
        const isGuest =
          typeof window !== "undefined" &&
          localStorage.getItem("kanso_guest_mode") === "true";

        supabase.auth.getSession().then(({ data: { session } }) => {
          const user = session?.user;
          if (user || isGuest) {
            queryClient.resumePausedMutations();
          } else {
            // Safety: Clear mutations if no valid session found on reload
            queryClient.getMutationCache().clear();
          }
        });
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
