"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ChatsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the standalone chat page (outside dashboard layout)
    router.replace("/operator-chat");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-100">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-neutral-600">Redirigiendo al chat...</p>
      </div>
    </div>
  );
}
