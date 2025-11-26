"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import OperatorChatPanel from "@/components/OperatorChatPanel";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2 } from "lucide-react";

export default function ChatsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-neutral-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return <OperatorChatPanel />;
}
