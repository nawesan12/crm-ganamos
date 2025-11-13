import { ReactNode } from "react";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f5f3ff] via-[#ede9fe] to-[#e5dcff]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.22),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.18),transparent_55%)]" />
        </div>
        <div className="relative z-10 flex min-h-screen flex-col">
          <DashboardNav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-10">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
