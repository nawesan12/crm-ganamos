"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDashboardRouteForRole } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";

export function AuthRedirect({ children }: PropsWithChildren) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [hydrated, setHydrated] = useState(
    () => useAuthStore.persist?.hasHydrated?.() ?? false,
  );

  useEffect(() => {
    if (hydrated) {
      return;
    }

    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });

    return () => {
      unsub?.();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) {
      return;
    }

    router.replace(getDashboardRouteForRole(user.role));
  }, [hydrated, isAuthenticated, router, user]);

  if (!hydrated) {
    return null;
  }

  return <>{children}</>;
}
