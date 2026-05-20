"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div {...slideUp} className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
        </div>

        <h1 className="text-3xl font-semibold">Private Access Only</h1>

        <p className="text-muted-foreground max-w-md">
          This app is for personal use only. If you believe you should have
          access, contact the owner.
        </p>

        <Button variant="outline" onClick={() => router.push("/login")}>
          Back to Login
        </Button>
      </motion.div>
    </div>
  );
}
