"use client";

import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function ChartCard({ title, subtitle, children, className, action }: ChartCardProps) {
  return (
    <Card className={`p-6 border-border/70 bg-background/95 backdrop-blur-sm ${className || ""}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="w-full">{children}</div>
    </Card>
  );
}
