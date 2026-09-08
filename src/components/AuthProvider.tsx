"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/client";
import { EMAIL_CONFIRMED_PATH } from "@/lib/auth/auth-routes";
import { purgeDeviceContent } from "@/lib/crypto/purge";
import type { OAuthProviderId } from "@/lib/auth/providers";
import type {
  User,
  Session,
  AuthError,
  UserIdentity,
} from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuestMode: boolean;
  signInWithOAuth: (provider: OAuthProviderId) => Promise<void>;
  signInWithMagicLink: (
    email: string,
    captchaToken: string,
  ) => Promise<{ error: AuthError | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    captchaToken: string,
  ) => Promise<{ error: AuthError | null }>;
  signInWithPassword: (
    email: string,
    password: string,
    captchaToken: string,
  ) => Promise<{ error: AuthError | null }>;
  resetPasswordForEmail: (
    email: string,
    captchaToken: string,
  ) => Promise<{ error: AuthError | null }>;
  updatePassword: (
    password: string,
    nonce?: string,
  ) => Promise<{ error: AuthError | null }>;
  reauthenticate: () => Promise<{ error: AuthError | null }>;
  linkIdentity: (
    provider: OAuthProviderId,
  ) => Promise<{ error: AuthError | null }>;
  unlinkIdentity: (
    identity: UserIdentity,
  ) => Promise<{ error: AuthError | null }>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setGuestFlag() {
  localStorage.setItem("kanso_guest_mode", "true");
  document.cookie =
    "kanso_guest_mode=true; path=/; max-age=31536000; SameSite=Lax";
}

function clearGuestFlag() {
  localStorage.removeItem("kanso_guest_mode");
  document.cookie = "kanso_guest_mode=; path=/; max-age=0";
}

function hasGuestFlag() {
  return localStorage.getItem("kanso_guest_mode") === "true";
}

function makeGuestUser(): User {
  return {
    id: "guest",
    email: "guest@demo.kanso",
    app_metadata: {},
    user_metadata: { display_name: "Guest User" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

export function AuthProvider({
  children,
  initialIsGuest = false,
}: {
  children: React.ReactNode;
  // Mirrors the server-side `kanso_guest_mode` cookie so first render matches SSR output (avoids a hydration error).
  initialIsGuest?: boolean;
}) {
  const [isGuestMode, setIsGuestMode] = useState<boolean>(initialIsGuest);
  const [user, setUser] = useState<User | null>(() =>
    initialIsGuest ? makeGuestUser() : null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!isGuestMode);
  const supabase = createClient();
  const queryClient = useQueryClient();

  useEffect(() => {
    // A real session always wins — a stale guest flag must not shadow it.
    const applyRealSession = (s: Session) => {
      clearGuestFlag();
      setSession(s);
      setUser(s.user);
      setIsGuestMode(false);
    };

    const applyNoRealSession = () => {
      if (hasGuestFlag()) {
        setUser(makeGuestUser());
        setIsGuestMode(true);
      } else {
        clearGuestFlag();
        setSession(null);
        setUser(null);
        setIsGuestMode(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) applyRealSession(session);
      else applyNoRealSession();
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // getSession() above already resolved this snapshot.
      if (event === "INITIAL_SESSION") return;

      if (session) applyRealSession(session);
      else applyNoRealSession();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signInWithOAuth = useCallback(
    async (provider: OAuthProviderId) => {
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    },
    [supabase.auth],
  );

  const signInWithMagicLink = useCallback(
    async (email: string, captchaToken: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          captchaToken,
        },
      });
      return { error };
    },
    [supabase.auth],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string, captchaToken: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(EMAIL_CONFIRMED_PATH)}`,
          captchaToken,
        },
      });
      return { error };
    },
    [supabase.auth],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string, captchaToken: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });
      return { error };
    },
    [supabase.auth],
  );

  const resetPasswordForEmail = useCallback(
    async (email: string, captchaToken: string) => {
      // Routes through the callback's existing `next` handling — no separate recovery-detection logic needed there.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
        captchaToken,
      });
      return { error };
    },
    [supabase.auth],
  );

  const updatePassword = useCallback(
    async (password: string, nonce?: string) => {
      const { error } = await supabase.auth.updateUser({ password, nonce });
      return { error };
    },
    [supabase.auth],
  );

  // Only relevant when Secure Password Change is on and the session is
  // >24h old — supabase.auth.updateUser() then fails with error code
  // "reauthentication_needed" until this has been called and its nonce
  // passed back into updatePassword().
  const reauthenticate = useCallback(async () => {
    const { error } = await supabase.auth.reauthenticate();
    return { error };
  }, [supabase.auth]);

  const linkIdentity = useCallback(
    async (provider: OAuthProviderId) => {
      // `connecting` lets AccountSection name the provider on a linking failure — see docs/adr/0012-identity-linking.md.
      const next = `/settings?tab=account&connecting=${provider}`;
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          // Forces the account picker; otherwise linking silently reuses whichever account is already signed in.
          ...((provider === "google" || provider === "github") && {
            queryParams: { prompt: "select_account" },
          }),
        },
      });
      return { error };
    },
    [supabase.auth],
  );

  const unlinkIdentity = useCallback(
    async (identity: UserIdentity) => {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (!error) {
        // getSession() would return the stale cached `identities`, still showing the disconnected provider as connected.
        const {
          data: { session },
        } = await supabase.auth.refreshSession();
        if (session) {
          setSession(session);
          setUser(session.user);
        }
      }
      return { error };
    },
    [supabase.auth],
  );

  const signInAsGuest = useCallback(() => {
    setGuestFlag();
    setUser(makeGuestUser());
    setIsGuestMode(true);
  }, []);

  const signOut = useCallback(async () => {
    if (isGuestMode) {
      // Guest data is the user's only copy — never purged.
      clearGuestFlag();
      setUser(null);
      setIsGuestMode(false);
    } else {
      await supabase.auth.signOut();
      try {
        await purgeDeviceContent(queryClient);
      } catch (err) {
        // A purge failure (e.g. IndexedDB blocked) must not strand the user
        // on a "signing out" screen — the session has already ended.
        Sentry.captureException(err);
      }
    }
  }, [supabase.auth, isGuestMode, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isGuestMode,
        signInWithOAuth,
        signInWithMagicLink,
        signUpWithPassword,
        signInWithPassword,
        resetPasswordForEmail,
        updatePassword,
        reauthenticate,
        linkIdentity,
        unlinkIdentity,
        signInAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
