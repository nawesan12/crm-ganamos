"use client";

import { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MiniAreaChart } from "./mini-area-chart";

type MetricCardProps = {
  title: string;
  value: string;
  icon: ReactNode;
  description?: string;
  trendLabel?: string;
  trendValue?: string;
  trendDirection?: "up" | "down" | "neutral";
  className?: string;
  sparklineData?: Array<{ value: number }>;
  sparklineColor?: string;
};

export function MetricCard({
  title,
  value,
  icon,
  description,
  trendLabel,
  trendValue,
  trendDirection = "neutral",
  className,
  sparklineData,
  sparklineColor,
}: MetricCardProps) {
  const trendColor =
    trendDirection === "up"
      ? "text-emerald-600"
      : trendDirection === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card className={cn("border-border/70 bg-background/90 transition-all hover:shadow-md hover:border-border/90", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <CardDescription className="text-xs uppercase tracking-[0.25em]">
            {trendLabel}
          </CardDescription>
        </div>
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <span className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {trendValue && (
          <span className={`text-sm font-medium ${trendColor}`}>{trendValue}</span>
        )}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-2 -mb-2">
            <MiniAreaChart data={sparklineData} color={sparklineColor} height={50} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
