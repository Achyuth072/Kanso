"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TaskSheet from "@/components/tasks/TaskSheet";

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const hasRedirected = useRef(false);

  // Derive shared content from URL params - no setState needed
  const sharedContent = useMemo(() => {
    const title = searchParams.get("title") || "";
    const text = searchParams.get("text") || "";
    const url = searchParams.get("url") || "";

    // Combine shared data into task content
    let content = "";
    if (title) {
      content = title;
    } else if (text) {
      content = text;
    }

    // Append URL if present
    if (url) {
      content = content ? `${content}\n${url}` : url;
    }

    return content;
  }, [searchParams]);

  // Handle opening/redirecting based on content - one-time effect on mount
  useEffect(() => {
    if (sharedContent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(true);
    } else if (!hasRedirected.current) {
      // No content shared, redirect to home
      hasRedirected.current = true;
      router.push("/");
    }
  }, [sharedContent, router]);

  const handleClose = () => {
    setIsOpen(false);
    // Small delay to allow close animation
    setTimeout(() => router.push("/"), 150);
  };

  return (
    <div className="min-h-screen bg-background">
      <TaskSheet
        open={isOpen}
        onClose={handleClose}
        initialTask={null}
        initialDate={null}
        initialContent={sharedContent}
      />
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SharePageContent />
    </Suspense>
  );
}
