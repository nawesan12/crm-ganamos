"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, UserCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthRole, useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  roles: AuthRole[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Administración",
    href: "/admin",
    roles: ["ADMIN"],
  },
  {
    label: "Caja diaria",
    href: "/cashier",
    roles: ["ADMIN", "CASHIER"],
  },
  {
    label: "CRM",
    href: "/crm",
    roles: ["ADMIN", "AGENT"],
  },
];

function useHydratedUser() {
  const [hydrated, setHydrated] = useState(() =>
    useAuthStore.persist?.hasHydrated?.() ?? false,
  );
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });

    return () => {
      unsub?.();
    };
  }, []);

  return { hydrated, user };
}

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const { hydrated, user } = useHydratedUser();
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    if (!user) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  }, [user]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-lg border border-border bg-primary/10 text-lg text-primary">
            G
          </span>
          <div className="flex flex-col leading-tight">
            <span>CRM Ganamos</span>
            <span className="text-xs text-muted-foreground">
              Paneles de operaciones
            </span>
          </div>
        </Link>

        {hydrated && items.length > 0 ? (
          <nav className="hidden items-center gap-2 md:flex">
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    active
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="hidden md:flex">&nbsp;</div>
        )}

        <div className="flex items-center gap-3">
          {hydrated && user ? (
            <div className="hidden flex-col items-end text-right text-xs sm:flex">
              <span className="font-medium text-foreground">{user.name}</span>
              <span className="text-muted-foreground capitalize">
                {user.role.toLowerCase()}
              </span>
            </div>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={handleLogout}
          >
            <LogOut className="size-5" />
            <span className="sr-only">Cerrar sesión</span>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Abrir navegación</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-4">
                {hydrated && user ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/40 p-4">
                    <UserCircle className="size-10 text-muted-foreground" />
                    <div className="flex flex-col text-sm">
                      <span className="font-medium text-foreground">
                        {user.name}
                      </span>
                      <span className="text-muted-foreground capitalize">
                        {user.role.toLowerCase()}
                      </span>
                    </div>
                  </div>
                ) : null}

                {items.length > 0 ? (
                  <nav className="flex flex-col gap-2">
                    {items.map((item) => {
                      const active = pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm transition",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted/60",
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                ) : null}

                <Button variant="outline" className="justify-start" onClick={handleLogout}>
                  <LogOut className="mr-2 size-4" /> Cerrar sesión
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
