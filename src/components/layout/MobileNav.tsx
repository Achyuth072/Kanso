"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckSquare, Calendar, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "All Tasks", icon: CheckSquare, path: "/" },
  { label: "Calendar", icon: Calendar, path: "/calendar" },
  { label: "Stats", icon: BarChart3, path: "/stats" },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { trigger, isPhone } = useHaptic();

  // Prefetch all routes on mount for instant navigation
  useEffect(() => {
    navItems.forEach((item) => router.prefetch(item.path));
  }, [router]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-sidebar md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-[60px] pb-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <motion.button
              key={item.path}
              onTapStart={() => trigger("toggle")} // Subtle vibration for nav
              whileTap={isPhone ? { scale: 0.95 } : {}}
              onClick={() => router.push(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all cursor-pointer outline-none",
                isActive
                  ? "text-brand"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="p-1">
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-[13px] font-medium leading-none">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
