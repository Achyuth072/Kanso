import { Suspense } from "react";
import { HomeClient } from "@/components/home/HomeClient";

// Performance: Root page is now a Server Component (PERF-01).
// Interactivity is moved to HomeClient to minimize the client-side hydration tree.
export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
