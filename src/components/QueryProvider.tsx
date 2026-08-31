"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/client";
import { taskMutations } from "@/lib/mutations/task";
import { habitMutations } from "@/lib/mutations/habit";
import { projectMutations } from "@/lib/mutations/project";
import { focusMutations } from "@/lib/mutations/focus";
import {
  asyncStoragePersister,
  purgePersistedQueryCache,
} from "@/lib/query-cache-purge";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5,
          gcTime: 1000 * 60 * 60 * 24 * 7,
          retry: 2,
          refetchOnWindowFocus: true,
          networkMode: "offlineFirst",
        },
        mutations: {
          retry: 1,
        },
      },
    });

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

    client.setMutationDefaults(["createProject"], {
      mutationFn: projectMutations.create,
    });
    client.setMutationDefaults(["updateProject"], {
      mutationFn: projectMutations.update,
    });
    client.setMutationDefaults(["archiveProject"], {
      mutationFn: projectMutations.archive,
    });

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
        maxAge: 1000 * 60 * 60 * 24 * 7,
      }}
      onSuccess={() => {
        const supabase = createClient();
        const isGuest =
          typeof window !== "undefined" &&
          localStorage.getItem("kanso_guest_mode") === "true";

        supabase.auth.getSession().then(({ data: { session } }) => {
          const user = session?.user;
          if (user || isGuest) {
            queryClient.resumePausedMutations();
          } else {
            // Safety: a restored cache with no valid session (expired,
            // revoked elsewhere) is the same "must not hold readable
            // content" case as an explicit sign-out — see purgePersistedQueryCache.
            purgePersistedQueryCache(queryClient).catch((err) =>
              Sentry.captureException(err),
            );
          }
        });
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
