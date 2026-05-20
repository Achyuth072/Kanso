"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function MagicLinkAuth() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { signInWithMagicLink } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await signInWithMagicLink(email);
      if (signInError) {
        setError(signInError.message || "Failed to send magic link");
      } else {
        setSent(true);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.form
            key="login-form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  strokeWidth={2.25}
                />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-9 h-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium transition-all"
              disabled={loading || !email}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Continuing...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="success-message"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-lg bg-primary/5 border border-primary/20"
          >
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2
                className="h-6 w-6 text-primary"
                strokeWidth={2.25}
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Check your email</h3>
              <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">
                We&apos;ve sent a magic link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Click it to sign in.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSent(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Didn&apos;t get the email? Try again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
