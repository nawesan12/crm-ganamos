"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleSlash2,
  Coins,
  Search,
  Sparkles,
  UsersRound,
  TrendingUp,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarComparisonChart } from "@/components/dashboard/bar-comparison-chart";
import { logger } from "@/lib/logger";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  LedgerMember,
  ChargeLogEntry,
  MembershipTier,
  DailyChargeSheetRow,
  getCashierDashboardData,
  getDailyChargeSheet,
  registerCharge,
  updateDailyChargeCheck,
} from "../../../actions/cashier";

const coinFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

type SheetStatusFilter = "all" | "charged" | "not-charged" | "pending";

export default function CashierDashboardPage() {
  return <CashierDashboardContent />;
}

function CashierDashboardContent() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [ledger, setLedger] = useState<LedgerMember[]>([]);
  const [chargeLog, setChargeLog] = useState<ChargeLogEntry[]>([]);
  const [dailySheet, setDailySheet] = useState<DailyChargeSheetRow[]>([]);
  const [pendingCharges, setPendingCharges] = useState<Record<number, string>>({});
  const [rowFeedback, setRowFeedback] = useState<Record<number, string | null>>({});
  const [sheetFeedback, setSheetFeedback] = useState<Record<number, string | null>>({});
  const [sheetSaving, setSheetSaving] = useState<Record<number, boolean>>({});
  const [tierFilter, setTierFilter] = useState<"all" | MembershipTier>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sheetStatusFilter, setSheetStatusFilter] = useState<SheetStatusFilter>("all");
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      Promise.all([
        getCashierDashboardData(selectedDate),
        getDailyChargeSheet(selectedDate),
      ])
        .then(([data, sheet]) => {
          setLedger(data.ledger);
          setChargeLog(data.chargeLog);
          setDailySheet(sheet);
          setPendingCharges({});
          setRowFeedback({});
          setSheetFeedback({});
          setSheetSaving({});
        })
        .catch((error) => {
          logger.error("Error loading dashboard data", error);
        });
    });
  }, [selectedDate]);

  const chargesForSelectedDate = useMemo(
    () => chargeLog.filter((entry) => entry.timestamp.startsWith(selectedDate)),
    [chargeLog, selectedDate],
  );

  const coinsChargedToday = useMemo(
    () => chargesForSelectedDate.reduce((acc, entry) => acc + entry.coins, 0),
    [chargesForSelectedDate],
  );

  const customersServedToday = useMemo(
    () => new Set(chargesForSelectedDate.map((entry) => entry.userId)).size,
    [chargesForSelectedDate],
  );

  const averageCoinsPerCharge = useMemo(() => {
    if (chargesForSelectedDate.length === 0) return 0;
    return Math.round(coinsChargedToday / chargesForSelectedDate.length);
  }, [chargesForSelectedDate.length, coinsChargedToday]);

  const pendingVisits = useMemo(
    () => ledger.filter((member) => !member.lastCharge || member.lastCharge !== selectedDate),
    [ledger, selectedDate],
  );

  const topMembersData = useMemo(() => {
    return ledger
      .sort((a, b) => b.coinsThisMonth - a.coinsThisMonth)
      .slice(0, 5)
      .map((member) => ({
        name: member.name.split(' ')[0],
        value: member.coinsThisMonth,
      }));
  }, [ledger]);

  const membershipDistribution = useMemo(() => {
    const tiers: MembershipTier[] = ['Premium', 'Estándar', 'Empresarial'];
    return tiers.map((tier) => ({
      name: tier,
      value: ledger.filter((m) => m.membership === tier).length,
      color: tier === 'Premium' ? '#8b5cf6' : tier === 'Estándar' ? '#6366f1' : '#3b82f6',
    }));
  }, [ledger]);

  const sparklineData = useMemo(() => {
    return Array.from({ length: 7 }, () => ({
      value: Math.floor(Math.random() * 150) + 50
    }));
  }, []);

  const filteredMembers = useMemo(() => {
    return ledger.filter((member) => {
      if (tierFilter !== "all" && member.membership !== tierFilter) return false;
      if (!searchTerm) return true;
      const normalized = searchTerm.toLowerCase();
      return member.name.toLowerCase().includes(normalized) ||
             member.membership.toLowerCase().includes(normalized);
    });
  }, [ledger, tierFilter, searchTerm]);

  const filteredDailySheet = useMemo(() => {
    return dailySheet.filter((row) => {
      const matchesSearch = !searchTerm ||
        row.username.toLowerCase().includes(searchTerm.toLowerCase());

      if (sheetStatusFilter === "charged") return matchesSearch && row.hasCharged === true;
      if (sheetStatusFilter === "not-charged") return matchesSearch && row.hasCharged === false;
      if (sheetStatusFilter === "pending") return matchesSearch && row.hasCharged === null;
      return matchesSearch;
    });
  }, [dailySheet, searchTerm, sheetStatusFilter]);

  const handleChargeSubmit = async (memberId: number) => {
    const rawValue = pendingCharges[memberId];
    const coins = Number(rawValue);

    if (!Number.isFinite(coins) || coins <= 0) {
      setRowFeedback((prev) => ({ ...prev, [memberId]: "Monto inválido" }));
      return;
    }

    try {
      const result = await registerCharge({ clientId: memberId, coins, selectedDate });
      setLedger((prev) =>
        prev.map((item) =>
          item.id === memberId
            ? { ...item, coinsThisMonth: item.coinsThisMonth + coins, lastCharge: result.lastChargeDate }
            : item,
        ),
      );
      setChargeLog((prev) => [result.newChargeLogEntry, ...prev]);
      setPendingCharges((prev) => ({ ...prev, [memberId]: "" }));
      setRowFeedback((prev) => ({ ...prev, [memberId]: `✓ ${coinFormatter.format(coins)} monedas` }));
    } catch (error) {
      logger.error("Error al registrar cargo", error);
      setRowFeedback((prev) => ({ ...prev, [memberId]: "Error al registrar" }));
    }
  };

  const handleDailyCheckUpdate = async (clientId: number, hasCharged: boolean) => {
    setSheetSaving((prev) => ({ ...prev, [clientId]: true }));
    try {
      const result = await updateDailyChargeCheck({ clientId, hasCharged, selectedDate });
      setDailySheet((prev) =>
        prev.map((row) =>
          row.clientId === clientId
            ? { ...row, hasCharged: result.hasCharged, checkedAt: result.checkedAt,
                checkedById: result.checkedById, checkedByName: result.checkedByName }
            : row,
        ),
      );
      setSheetFeedback((prev) => ({ ...prev, [clientId]: hasCharged ? "✓ Cargó" : "✗ No cargó" }));
    } catch (error) {
      logger.error("Error al actualizar", error);
      setSheetFeedback((prev) => ({ ...prev, [clientId]: "Error" }));
    } finally {
      setSheetSaving((prev) => ({ ...prev, [clientId]: false }));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Panel de Caja</h1>
          <p className="text-sm text-muted-foreground mt-1">Conciliación diaria de monedas</p>
        </div>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Monedas hoy"
          value={coinFormatter.format(coinsChargedToday)}
          icon={<Coins className="size-5" />}
          trendValue={coinsChargedToday > 0 ? `+${chargesForSelectedDate.length} cargos` : "Sin cargos"}
          trendDirection={coinsChargedToday > 0 ? "up" : "neutral"}
          sparklineData={sparklineData}
          sparklineColor="#8b5cf6"
        />
        <MetricCard
          title="Miembros atendidos"
          value={`${customersServedToday}`}
          icon={<UsersRound className="size-5" />}
          trendValue={`${chargesForSelectedDate.length} visitas`}
          trendDirection={customersServedToday > 0 ? "up" : "neutral"}
        />
        <MetricCard
          title="Promedio por cargo"
          value={`${coinFormatter.format(averageCoinsPerCharge)}`}
          icon={<Sparkles className="size-5" />}
          trendValue={averageCoinsPerCharge >= 120 ? "Sobre objetivo" : "Bajo objetivo"}
          trendDirection={averageCoinsPerCharge >= 120 ? "up" : "down"}
          description="Objetivo: 120"
        />
        <MetricCard
          title="Pendientes"
          value={`${pendingVisits.length}`}
          icon={<CalendarClock className="size-5" />}
          trendValue={pendingVisits.length === 0 ? "Completado" : "En progreso"}
          trendDirection={pendingVisits.length === 0 ? "up" : "neutral"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Top miembros" subtitle="Monedas acumuladas este mes">
          <BarComparisonChart
            data={topMembersData}
            valueFormatter={(value) => coinFormatter.format(value)}
            height={220}
          />
        </ChartCard>

        <ChartCard title="Distribución de membresías" subtitle="Miembros por tier">
          <BarComparisonChart
            data={membershipDistribution}
            valueFormatter={(value) => value.toString()}
            height={220}
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-background/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="size-5 text-primary" />
              Registro de cargos
            </CardTitle>
            <CardDescription>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <Search className="size-4" />
                  <Input
                    placeholder="Buscar miembro..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 w-48"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={tierFilter === "all" ? "default" : "outline"}
                    onClick={() => setTierFilter("all")}
                  >
                    Todos
                  </Button>
                  <Button
                    size="sm"
                    variant={tierFilter === "Premium" ? "default" : "outline"}
                    onClick={() => setTierFilter("Premium")}
                  >
                    Premium
                  </Button>
                  <Button
                    size="sm"
                    variant={tierFilter === "Estándar" ? "default" : "outline"}
                    onClick={() => setTierFilter("Estándar")}
                  >
                    Estándar
                  </Button>
                  <Button
                    size="sm"
                    variant={tierFilter === "Empresarial" ? "default" : "outline"}
                    onClick={() => setTierFilter("Empresarial")}
                  >
                    Empresarial
                  </Button>
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredMembers.slice(0, 20).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/80 p-3 transition-all hover:border-border/90"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{member.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      member.membership === 'Premium' ? 'bg-purple-100 text-purple-800' :
                      member.membership === 'Estándar' ? 'bg-blue-100 text-blue-800' :
                      'bg-indigo-100 text-indigo-800'
                    }`}>
                      {member.membership}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{coinFormatter.format(member.coinsThisMonth)} este mes</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Monedas"
                    value={pendingCharges[member.id] || ""}
                    onChange={(e) => setPendingCharges((prev) => ({ ...prev, [member.id]: e.target.value }))}
                    className="w-24 h-9 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleChargeSubmit(member.id)}
                  >
                    Cargar
                  </Button>
                </div>
              </div>
            ))}
            {rowFeedback && Object.entries(rowFeedback).map(([id, msg]) => msg && (
              <p key={id} className="text-xs text-muted-foreground px-3">{msg}</p>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              Control diario
            </CardTitle>
            <CardDescription>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button
                  size="sm"
                  variant={sheetStatusFilter === "all" ? "default" : "outline"}
                  onClick={() => setSheetStatusFilter("all")}
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={sheetStatusFilter === "charged" ? "default" : "outline"}
                  onClick={() => setSheetStatusFilter("charged")}
                >
                  Cargó
                </Button>
                <Button
                  size="sm"
                  variant={sheetStatusFilter === "not-charged" ? "default" : "outline"}
                  onClick={() => setSheetStatusFilter("not-charged")}
                >
                  No cargó
                </Button>
                <Button
                  size="sm"
                  variant={sheetStatusFilter === "pending" ? "default" : "outline"}
                  onClick={() => setSheetStatusFilter("pending")}
                >
                  Pendiente
                </Button>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredDailySheet.slice(0, 20).map((row) => (
              <div
                key={row.clientId}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 p-3 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">@{row.username}</p>
                  {row.checkedByName && (
                    <p className="text-xs text-muted-foreground">Por {row.checkedByName}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={row.hasCharged === true ? "default" : "outline"}
                    onClick={() => handleDailyCheckUpdate(row.clientId, true)}
                    disabled={sheetSaving[row.clientId]}
                  >
                    <CheckCircle2 className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={row.hasCharged === false ? "default" : "outline"}
                    onClick={() => handleDailyCheckUpdate(row.clientId, false)}
                    disabled={sheetSaving[row.clientId]}
                  >
                    <CircleSlash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            {sheetFeedback && Object.entries(sheetFeedback).map(([id, msg]) => msg && (
              <p key={id} className="text-xs text-muted-foreground px-3">{msg}</p>
            ))}
          </CardContent>
        </Card>
      </div>

      {chargesForSelectedDate.length > 0 && (
        <Card className="border-border/70 bg-background/95">
          <CardHeader>
            <CardTitle>Registro de conciliación</CardTitle>
            <CardDescription>Últimos {Math.min(10, chargesForSelectedDate.length)} cargos del día</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {chargesForSelectedDate.slice(0, 10).map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 p-3"
              >
                <div>
                  <p className="font-medium text-sm">{entry.userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{coinFormatter.format(entry.coins)} monedas</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
