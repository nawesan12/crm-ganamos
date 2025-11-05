"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="size-5" />
                <span className="sr-only">Abrir navegación</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-4"></div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
