import { ReactNode } from "react";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background">
      <DashboardNav />
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        {children}
      </main>
    </div>
  );
}
