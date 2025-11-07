// app/(dashboard)/cashier/page.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleSlash2,
  ClipboardList,
  Coins,
  Filter,
  Menu,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { MetricCard } from "@/components/dashboard/metric-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  return (
    <AuthGuard allowedRoles={["ADMIN", "CASHIER"]}>
      <CashierDashboardContent />
    </AuthGuard>
  );
}

function CashierDashboardContent() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [ledger, setLedger] = useState<LedgerMember[]>([]);
  const [chargeLog, setChargeLog] = useState<ChargeLogEntry[]>([]);
  const [dailySheet, setDailySheet] = useState<DailyChargeSheetRow[]>([]);
  const [pendingCharges, setPendingCharges] = useState<Record<number, string>>(
    {},
  );
  const [rowFeedback, setRowFeedback] = useState<Record<number, string | null>>(
    {},
  );
  const [sheetFeedback, setSheetFeedback] = useState<
    Record<number, string | null>
  >({});
  const [sheetSaving, setSheetSaving] = useState<Record<number, boolean>>({});
  const [tierFilter, setTierFilter] = useState<"all" | MembershipTier>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sheetSearchTerm, setSheetSearchTerm] = useState("");
  const [sheetStatusFilter, setSheetStatusFilter] =
    useState<SheetStatusFilter>("all");
  const [notes, setNotes] = useState(
    "Confirmar el cajón de efectivo al cierre y sincronizar los totales con finanzas antes de las 7 PM.",
  );
  const [notesMessage, setNotesMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [showMemberFilters, setShowMemberFilters] = useState(false);
  const [showDailyFilters, setShowDailyFilters] = useState(false);

  const quickMenuSections = [
    { href: "#indicadores-turno", label: "Indicadores del día" },
    { href: "#tablero-cargos", label: "Tablero de cargos" },
    { href: "#hoja-control", label: "Hoja de control" },
    { href: "#registro-conciliacion", label: "Registro de conciliación" },
    { href: "#notas-turno", label: "Notas de turno" },
  ];

  // Cargar datos cuando cambia la fecha
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
          console.error("Error loading dashboard data", error);
        });
    });
  }, [selectedDate]);

  useEffect(() => {
    if (!isQuickMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsQuickMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQuickMenuOpen]);

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
    if (chargesForSelectedDate.length === 0) {
      return 0;
    }
    return Math.round(coinsChargedToday / chargesForSelectedDate.length);
  }, [chargesForSelectedDate.length, coinsChargedToday]);

  const pendingVisits = useMemo(
    () =>
      ledger.filter(
        (member) => !member.lastCharge || member.lastCharge !== selectedDate,
      ),
    [ledger, selectedDate],
  );

  const filteredMembers = useMemo(() => {
    return ledger.filter((member) => {
      if (tierFilter !== "all" && member.membership !== tierFilter) {
        return false;
      }

      if (!searchTerm) return true;

      const normalized = searchTerm.toLowerCase();
      return (
        member.name.toLowerCase().includes(normalized) ||
        member.membership.toLowerCase().includes(normalized)
      );
    });
  }, [ledger, tierFilter, searchTerm]);

  const filteredDailySheet = useMemo(() => {
    const normalized = sheetSearchTerm.trim().toLowerCase();

    return dailySheet.filter((row) => {
      if (normalized) {
        const matchesUsername = row.username.toLowerCase().includes(normalized);
        const matchesPhone = row.phone
          ? row.phone.toLowerCase().includes(normalized)
          : false;

        if (!matchesUsername && !matchesPhone) {
          return false;
        }
      }

      if (sheetStatusFilter === "charged") {
        return row.hasCharged === true;
      }

      if (sheetStatusFilter === "not-charged") {
        return row.hasCharged === false;
      }

      if (sheetStatusFilter === "pending") {
        return row.hasCharged === null;
      }

      return true;
    });
  }, [dailySheet, sheetSearchTerm, sheetStatusFilter]);

  const handleChargeSubmit = async (memberId: number) => {
    const rawValue = pendingCharges[memberId];
    const coins = Number(rawValue);

    if (!Number.isFinite(coins) || coins <= 0) {
      setRowFeedback((prev) => ({
        ...prev,
        [memberId]: "Ingrese un monto positivo para registrar.",
      }));
      return;
    }

    const member = ledger.find((item) => item.id === memberId);
    if (!member) return;

    try {
      // Persistimos en la DB
      const result = await registerCharge({
        clientId: memberId,
        coins,
        selectedDate,
      });

      // Actualizamos el ledger local
      setLedger((prev) =>
        prev.map((item) =>
          item.id === memberId
            ? {
                ...item,
                coinsThisMonth: item.coinsThisMonth + coins,
                lastCharge: result.lastChargeDate,
              }
            : item,
        ),
      );

      // Agregamos el nuevo registro al log local
      setChargeLog((prev) => [result.newChargeLogEntry, ...prev]);

      // Limpiamos input + feedback
      setPendingCharges((prev) => ({
        ...prev,
        [memberId]: "",
      }));
      setRowFeedback((prev) => ({
        ...prev,
        [memberId]: `${coinFormatter.format(coins)} monedas registradas`,
      }));
    } catch (error) {
      console.error("Error al registrar cargo", error);
      setRowFeedback((prev) => ({
        ...prev,
        [memberId]:
          "No se pudo registrar el cargo. Intente nuevamente o contacte a soporte.",
      }));
    }
  };

  const handleDailyCheckUpdate = async (
    clientId: number,
    hasCharged: boolean,
  ) => {
    setSheetSaving((prev) => ({
      ...prev,
      [clientId]: true,
    }));
    setSheetFeedback((prev) => ({
      ...prev,
      [clientId]: null,
    }));

    try {
      const result = await updateDailyChargeCheck({
        clientId,
        hasCharged,
        selectedDate,
      });

      setDailySheet((prev) =>
        prev.map((row) =>
          row.clientId === clientId
            ? {
                ...row,
                hasCharged: result.hasCharged,
                checkedAt: result.checkedAt,
                checkedById: result.checkedById,
                checkedByName: result.checkedByName,
              }
            : row,
        ),
      );

      setSheetFeedback((prev) => ({
        ...prev,
        [clientId]: hasCharged
          ? "Marcado como cargó hoy."
          : "Marcado como no cargó.",
      }));
    } catch (error) {
      console.error("Error al actualizar estado diario", error);
      setSheetFeedback((prev) => ({
        ...prev,
        [clientId]: "No se pudo actualizar el registro. Intente nuevamente.",
      }));
    } finally {
      setSheetSaving((prev) => ({
        ...prev,
        [clientId]: false,
      }));
    }
  };

  const handleSaveNotes = () => {
    // Por ahora las notas quedan solo en el estado local
    // Si querés que se guarden en DB, después hacemos un Notes model + server action
    setNotesMessage("Notas de turno guardadas para el equipo.");
  };

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-3">
        <span className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Operaciones de cajero
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Conciliación diaria de monedas sin problemas
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Registre cada visita de cliente, realice un seguimiento de las monedas
          entregadas y mantenga un registro instantáneo para finanzas. Los
          filtros y las notas rápidas ayudan al próximo turno a saber
          exactamente cómo están las cosas.
        </p>
      </section>

      <section
        id="indicadores-turno"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          title="Monedas registradas hoy"
          value={coinFormatter.format(coinsChargedToday)}
          icon={<Coins className="size-5" />}
          trendLabel="Fecha seleccionada"
          trendValue={
            coinsChargedToday > 0
              ? `▲ ${coinFormatter.format(coinsChargedToday)} monedas`
              : "Esperando el primer cargo"
          }
          trendDirection={coinsChargedToday > 0 ? "up" : "neutral"}
          description="Suma de los cargos registrados en el libro mayor"
        />
        <MetricCard
          title="Miembros atendidos"
          value={`${customersServedToday}`}
          icon={<UsersRound className="size-5" />}
          trendLabel="Visitantes únicos"
          trendValue={
            customersServedToday > 0
              ? `${customersServedToday} visitas completadas`
              : "Aún no hay visitantes"
          }
          trendDirection={customersServedToday > 0 ? "up" : "neutral"}
          description="Miembros únicos con al menos un cargo"
        />
        <MetricCard
          title="Promedio por cargo"
          value={`${coinFormatter.format(averageCoinsPerCharge)} monedas`}
          icon={<Sparkles className="size-5" />}
          trendLabel="Eficiencia"
          trendValue="Objetivo: 120 monedas"
          trendDirection={averageCoinsPerCharge >= 120 ? "up" : "down"}
          description="Pagos diarios de referencia para la dotación de personal"
        />
        <MetricCard
          title="Visitas pendientes"
          value={`${pendingVisits.length}`}
          icon={<CalendarClock className="size-5" />}
          trendLabel="Esperando confirmación"
          trendValue={
            pendingVisits.length > 0
              ? `${pendingVisits.length} miembros pendientes`
              : "Todos los miembros atendidos"
          }
          trendDirection={pendingVisits.length === 0 ? "up" : "neutral"}
          description="Miembros que aún no han sido cobrados en el día seleccionado"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section id="tablero-cargos">
            <Card className="border-border/70 bg-background/90">
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Tablero de cargos diarios
                  </CardTitle>
                  <CardDescription>
                    Capture las visitas de hoy con solo unos pocos clics. Los montos
                    actualizan el libro mayor al instante.
                  </CardDescription>
                </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex flex-col text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Fecha de trabajo
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="mt-1"
                  />
                </label>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showMemberFilters ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <Search className="size-4 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Buscar miembro o nivel"
                        className="h-8 border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="size-4 text-muted-foreground" />
                      <select
                        className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                        value={tierFilter}
                        onChange={(event) =>
                          setTierFilter(event.target.value as typeof tierFilter)
                        }
                      >
                        <option value="all">Todos los niveles</option>
                        <option value="Premium">Premium</option>
                        <option value="Estándar">Estándar</option>
                        <option value="Empresarial">Empresarial</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMemberFilters(false)}
                    >
                      Ocultar filtros
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Filtros del libro mayor ocultos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ábrelos cuando los necesites desde aquí o con el menú flotante.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMemberFilters(true)}
                  >
                    Mostrar filtros
                  </Button>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-border/60">
                <div className="hidden grid-cols-[2fr_1fr_1fr_1.2fr] bg-muted/40 px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground md:grid">
                  <span>Miembro</span>
                  <span>Nivel</span>
                  <span>Monedas este mes</span>
                  <span className="text-right">Registrar cargo</span>
                </div>
                <div className="divide-y divide-border/60">
                  {isPending && ledger.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Cargando datos del turno...
                    </div>
                  ) : filteredMembers.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Ningún miembro coincide con los filtros. Ajuste la búsqueda
                      o el nivel.
                    </div>
                  ) : (
                    filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="grid gap-4 px-4 py-4 text-sm md:grid-cols-[2fr_1fr_1fr_1.2fr] md:items-center md:px-6"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {member.name}
                          </span>
                          {member.visitWindow && (
                            <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                              {member.visitWindow}
                            </span>
                          )}
                          {member.preferences && (
                            <span className="text-xs text-muted-foreground">
                              {member.preferences}
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {member.membership}
                        </span>
                        <span className="text-muted-foreground">
                          {coinFormatter.format(member.coinsThisMonth)} monedas
                        </span>
                        <div className="flex flex-col gap-2 md:items-end">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              placeholder="0"
                              value={pendingCharges[member.id] ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setPendingCharges((prev) => ({
                                  ...prev,
                                  [member.id]: value,
                                }));
                                if (rowFeedback[member.id]) {
                                  setRowFeedback((prev) => ({
                                    ...prev,
                                    [member.id]: null,
                                  }));
                                }
                              }}
                              className="h-9 w-24 text-right"
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleChargeSubmit(member.id)}
                            >
                              Registrar
                            </Button>
                          </div>
                          {rowFeedback[member.id] && (
                            <span className="text-xs text-muted-foreground">
                              {rowFeedback[member.id]}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </section>

          <section id="hoja-control">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground">
                  Hoja de control diario
                </CardTitle>
                <CardDescription>
                  Marque quién cargó puntos en la fecha seleccionada para dejar
                  constancia al equipo administrativo.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showDailyFilters ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                      <Search className="size-4 text-muted-foreground" />
                      <Input
                        value={sheetSearchTerm}
                        onChange={(event) => setSheetSearchTerm(event.target.value)}
                        placeholder="Buscar por usuario o teléfono"
                        className="h-8 border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="size-4 text-muted-foreground" />
                      <select
                        className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                        value={sheetStatusFilter}
                        onChange={(event) =>
                          setSheetStatusFilter(
                            event.target.value as SheetStatusFilter,
                          )
                        }
                      >
                        <option value="all">Todos los estados</option>
                        <option value="charged">Marcados como cargó</option>
                        <option value="not-charged">Marcados como no cargó</option>
                        <option value="pending">Sin registro</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDailyFilters(false)}
                    >
                      Ocultar filtros
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Filtros de la hoja de control ocultos
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Actívalos desde aquí o con el menú flotante para afinar la vista.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDailyFilters(true)}
                  >
                    Mostrar filtros
                  </Button>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-border/60">
                <div className="hidden grid-cols-[1.6fr_1.1fr_1.2fr] bg-muted/40 px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground md:grid">
                  <span>Cliente</span>
                  <span>Estado del día</span>
                  <span className="text-right">Actualizar</span>
                </div>
                <div className="divide-y divide-border/60">
                  {isPending && dailySheet.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Cargando usuarios...
                    </div>
                  ) : filteredDailySheet.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Ningún usuario coincide con los filtros seleccionados.
                    </div>
                  ) : (
                    filteredDailySheet.map((row) => {
                      const statusLabel =
                        row.hasCharged === true
                          ? "Cobró hoy"
                          : row.hasCharged === false
                            ? "No cargó"
                            : "Sin registro";
                      const statusClasses =
                        row.hasCharged === true
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                          : row.hasCharged === false
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-600"
                            : "border-border/60 bg-muted/60 text-muted-foreground";
                      const statusIcon =
                        row.hasCharged === true ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : row.hasCharged === false ? (
                          <CircleSlash2 className="size-3.5" />
                        ) : (
                          <CalendarClock className="size-3.5" />
                        );
                      const lastUpdate = row.checkedAt
                        ? new Date(row.checkedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : null;

                      return (
                        <div
                          key={row.clientId}
                          className="grid gap-4 px-4 py-4 text-sm md:grid-cols-[1.6fr_1.1fr_1.2fr] md:items-center md:px-6"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">
                              {row.username}
                            </span>
                            {row.phone && (
                              <span className="text-xs text-muted-foreground">
                                {row.phone}
                              </span>
                            )}
                            <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                              {row.status}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses}`}
                            >
                              {statusIcon}
                              {statusLabel}
                            </span>
                            {row.checkedAt ? (
                              <span className="text-xs text-muted-foreground">
                                Actualizado {lastUpdate}
                                {row.checkedByName
                                  ? ` · ${row.checkedByName}`
                                  : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Aún sin confirmación para esta fecha.
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 md:items-end">
                            {row.hasCharged === null ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    handleDailyCheckUpdate(row.clientId, true)
                                  }
                                  disabled={sheetSaving[row.clientId]}
                                >
                                  <CheckCircle2 className="mr-2 size-4" />
                                  Cobró
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleDailyCheckUpdate(row.clientId, false)
                                  }
                                  disabled={sheetSaving[row.clientId]}
                                >
                                  <CircleSlash2 className="mr-2 size-4" />
                                  No cobró
                                </Button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                                Estado registrado para hoy
                              </span>
                            )}
                            {sheetSaving[row.clientId] && (
                              <span className="text-xs text-muted-foreground">
                                Guardando cambios...
                              </span>
                            )}
                            {sheetFeedback[row.clientId] && (
                              <span className="text-xs text-muted-foreground">
                                {sheetFeedback[row.clientId]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <section id="registro-conciliacion">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground">
                  Registro de conciliación diaria
                </CardTitle>
                <CardDescription>
                  Todas las monedas registradas para la fecha seleccionada
                  aparecen aquí al instante.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {chargesForSelectedDate.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-muted-foreground">
                  Aún no se han registrado cargos en esta fecha.
                </div>
              ) : (
                chargesForSelectedDate.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/80 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {entry.userName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {coinFormatter.format(entry.coins)} monedas • Registrado
                        a las{" "}
                        {new Date(entry.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {entry.note && (
                        <p className="text-xs text-muted-foreground">
                          {entry.note}
                        </p>
                      )}
                    </div>
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  </div>
                ))
              )}
            </CardContent>
            <CardFooter className="justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Coins className="size-4" />
                {coinFormatter.format(coinsChargedToday)} monedas hoy
              </div>
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4" />
                {chargesForSelectedDate.length} registros totales
              </div>
            </CardFooter>
            </Card>
          </section>

          <section id="notas-turno">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground">
                  Notas de turno
                </CardTitle>
                <CardDescription>
                  Deje una guía para el próximo cajero o resuma los incidentes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
              />
              {notesMessage && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  {notesMessage}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setNotes(
                    "Confirmar el cajón de efectivo al cierre y sincronizar los totales con finanzas antes de las 7 PM.",
                  );
                  setNotesMessage(null);
                }}
              >
                Restablecer nota
              </Button>
              <Button onClick={handleSaveNotes}>Guardar para el turno</Button>
            </CardFooter>
            </Card>
          </section>
        </div>
      </div>

      {isQuickMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/30 backdrop-blur-sm"
          onClick={() => setIsQuickMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav
        aria-label="Menú flotante de navegación"
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      >
        {isQuickMenuOpen && (
          <div className="w-64 rounded-2xl border border-border/60 bg-background/95 p-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Navegación rápida
            </p>
            <ul className="mt-3 space-y-1">
              {quickMenuSections.map((item) => (
                <li key={item.href}>
                  <a
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-muted/60"
                    href={item.href}
                    onClick={() => setIsQuickMenuOpen(false)}
                  >
                    {item.label}
                    <span className="text-xs text-muted-foreground">↗</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Controles
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full rounded-lg border border-border/60 px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted/60"
                  onClick={() => {
                    setShowMemberFilters((prev) => !prev);
                    setIsQuickMenuOpen(false);
                  }}
                >
                  {showMemberFilters
                    ? "Ocultar filtros de miembros"
                    : "Mostrar filtros de miembros"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-border/60 px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted/60"
                  onClick={() => {
                    setShowDailyFilters((prev) => !prev);
                    setIsQuickMenuOpen(false);
                  }}
                >
                  {showDailyFilters
                    ? "Ocultar filtros de hoja"
                    : "Mostrar filtros de hoja"}
                </button>
              </div>
            </div>
          </div>
        )}
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setIsQuickMenuOpen((prev) => !prev)}
          aria-expanded={isQuickMenuOpen}
          aria-label={
            isQuickMenuOpen ? "Cerrar menú flotante" : "Abrir menú flotante"
          }
        >
          {isQuickMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </nav>
    </div>
  );
}
