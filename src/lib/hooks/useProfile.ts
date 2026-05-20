"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Profile, UserSettings, DEFAULT_USER_SETTINGS } from "../types/profile";

export function useProfile() {
  const { user, isGuestMode } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async (): Promise<Profile | null> => {
      if (!user || isGuestMode) return null;

      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return null;
      }

      // Ensure settings has defaults (deep merge notifications)
      const profile = data as Profile;
      return {
        ...profile,
        settings: {
          ...DEFAULT_USER_SETTINGS,
          ...profile.settings,
          notifications: {
            ...DEFAULT_USER_SETTINGS.notifications,
            ...(profile.settings?.notifications || {}),
          } as UserSettings["notifications"],
        },
      };
    },
    enabled: !!user && !isGuestMode,
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user || isGuestMode) return;

      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>) => {
      if (!user || isGuestMode) return;

      const cachedProfile = queryClient.getQueryData<Profile>([
        "profile",
        user?.id,
      ]);
      const currentSettings = cachedProfile?.settings || DEFAULT_USER_SETTINGS;
      const mergedSettings = {
        ...currentSettings,
        ...newSettings,
        notifications: {
          ...(currentSettings.notifications || {}),
          ...(newSettings.notifications || {}),
        },
      };

      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ settings: mergedSettings })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    updateProfile,
    updateSettings,
  };
}
