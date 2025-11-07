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
    <header className="sticky top-0 z-30 border-b border-primary/20 bg-gradient-to-r from-[#3b1d68]/80 via-[#2d1559]/80 to-[#24124a]/80 text-primary-foreground backdrop-blur supports-[backdrop-filter]:bg-[#1c0d38]/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-primary-foreground"
        >
          <span className="grid size-9 place-items-center rounded-lg border border-primary/30 bg-gradient-to-br from-primary/90 via-primary to-[#5b21b6] text-lg font-bold text-primary-foreground shadow shadow-primary/30">
            G
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-primary-foreground">CRM Ganamos</span>
            <span className="text-xs font-normal text-primary-foreground/70">
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
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    active
                      ? "bg-gradient-to-r from-primary via-[#8147f0] to-[#6d28d9] text-primary-foreground shadow-lg shadow-primary/30"
                      : "text-primary-foreground/70 hover:bg-primary/15 hover:text-primary-foreground",
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
              <span className="font-medium text-primary-foreground">
                {user.name}
              </span>
              <span className="text-primary-foreground/70 capitalize">
                {user.role.toLowerCase()}
              </span>
            </div>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className="hidden text-primary-foreground hover:bg-primary/20 md:inline-flex"
            onClick={handleLogout}
          >
            <LogOut className="size-5" />
            <span className="sr-only">Cerrar sesión</span>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="border-primary/40 bg-primary/10 text-primary-foreground hover:bg-primary/20 md:hidden"
              >
                <Menu className="size-5" />
                <span className="sr-only">Abrir navegación</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 border-l border-primary/20 bg-gradient-to-b from-[#f5f0ff] to-[#efe1ff] text-foreground dark:from-[#1c0d38] dark:to-[#0f051f] dark:text-primary-foreground"
            >
              <div className="mt-8 flex flex-col gap-4">
                {hydrated && user ? (
                  <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/15 to-transparent p-4 text-primary-foreground">
                    <UserCircle className="size-10 text-primary-foreground/80" />
                    <div className="flex flex-col text-sm text-left">
                      <span className="font-medium text-primary-foreground">
                        {user.name}
                      </span>
                      <span className="text-primary-foreground/70 capitalize">
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
                            "rounded-lg px-3 py-2 text-sm font-medium transition",
                            active
                              ? "bg-gradient-to-r from-primary via-[#8147f0] to-[#6d28d9] text-primary-foreground shadow shadow-primary/30"
                              : "text-foreground/80 hover:bg-primary/15 hover:text-foreground dark:text-primary-foreground/70 dark:hover:text-primary-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                ) : null}

                <Button
                  variant="outline"
                  className="justify-start border-primary/30 bg-primary/10 text-foreground hover:bg-primary/20 dark:text-primary-foreground"
                  onClick={handleLogout}
                >
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
