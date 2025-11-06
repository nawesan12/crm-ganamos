"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getDashboardRouteForRole } from "@/lib/auth";
import { AuthRole, useAuthStore } from "@/stores/auth-store";

function useAuthHydration() {
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist?.hasHydrated?.() ?? false,
  );

  useEffect(() => {
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });

    return () => {
      unsub?.();
    };
  }, []);

  return hydrated;
}

function resolveFallbackRoute(role: AuthRole | undefined, pathname: string) {
  if (role) {
    return getDashboardRouteForRole(role);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/cashier")) {
    return "/login";
  }

  return "/login";
}

export function AuthGuard({
  children,
  allowedRoles,
}: PropsWithChildren<{ allowedRoles?: AuthRole[] }>) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthHydration();
  const { isAuthenticated, user } = useAuthStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    user: state.user,
  }));

  useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace(resolveFallbackRoute(user.role, pathname));
    }
  }, [allowedRoles, hydrated, isAuthenticated, pathname, router, user]);

  if (!hydrated) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Preparando tu espacio...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
