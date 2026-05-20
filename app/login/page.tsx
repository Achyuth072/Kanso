"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MagicLinkAuth } from "@/components/auth/MagicLinkAuth";
import { UserCircle } from "lucide-react";

const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

function LoginContent() {
  const { user, loading, isGuestMode, signInWithGoogle, signInAsGuest } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  useEffect(() => {
    if (!loading && user && !isGuestMode) {
      router.push("/");
    }
  }, [user, loading, isGuestMode, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleGuestSignIn = () => {
    signInAsGuest();
    router.push("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div {...slideUp} className="max-w-md w-full">
        <div className="p-8 rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col items-center gap-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <span className="text-3xl font-bold">K</span>
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Kanso</h1>
              <p className="text-[13px] font-medium text-muted-foreground/80 lowercase tracking-wide">
                Zen-minimalist productivity suite
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium text-center bg-destructive/10 p-3 rounded-lg w-full">
                {error.includes("Signups not allowed") ||
                error.includes("signup_disabled")
                  ? "This app is private. Only authorized users can sign in."
                  : "Authentication failed. Please try again."}
              </p>
            )}

            <MagicLinkAuth />

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <Button
                variant="outline"
                onClick={signInWithGoogle}
                className="flex items-center justify-center gap-2 h-11 bg-background/50 border-border hover:bg-accent transition-all duration-200"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="currentColor"
                    fillOpacity="0.8"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="currentColor"
                    fillOpacity="0.6"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="currentColor"
                    fillOpacity="0.9"
                  />
                </svg>
                <span className="text-sm font-medium">Google</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleGuestSignIn}
                className="flex items-center justify-center gap-2 h-11 bg-background/50 border-border hover:bg-accent transition-all duration-200"
              >
                <UserCircle className="h-4 w-4" strokeWidth={2.25} />
                <span className="text-sm font-medium">Guest</span>
              </Button>
            </div>

            <div className="space-y-4 w-full">
              <p className="text-[11px] leading-relaxed text-muted-foreground text-center px-4">
                By continuing, you agree to our Terms of Service and Privacy
                Policy. Guest data is stored locally and will be lost if
                cleared.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
