"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Coins,
  Filter,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";

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

type MembershipTier = "Premium" | "Estándar" | "Empresarial";

type LedgerMember = {
  id: string;
  name: string;
  membership: MembershipTier;
  coinsThisMonth: number;
  visitWindow: string;
  lastCharge?: string;
  preferences?: string;
};

type ChargeLogEntry = {
  id: string;
  userId: string;
  userName: string;
  coins: number;
  timestamp: string;
  note?: string;
};

const initialLedger: LedgerMember[] = [
  {
    id: "m-1",
    name: "Carlos Mendoza",
    membership: "Premium",
    coinsThisMonth: 340,
    visitWindow: "09:00 - 10:30",
    lastCharge: "2024-08-20",
    preferences: "Enviar factura por correo electrónico",
  },
  {
    id: "m-2",
    name: "Lucía Herrera",
    membership: "Estándar",
    coinsThisMonth: 180,
    visitWindow: "11:00 - 12:30",
    lastCharge: "2024-08-21",
    preferences: "Prefiere recibo en efectivo",
  },
  {
    id: "m-3",
    name: "Andrés Quiroz",
    membership: "Empresarial",
    coinsThisMonth: 520,
    visitWindow: "14:00 - 15:30",
    lastCharge: "2024-08-19",
    preferences: "Validar identificación antes de entregar monedas",
  },
  {
    id: "m-4",
    name: "Sara Domínguez",
    membership: "Premium",
    coinsThisMonth: 260,
    visitWindow: "16:00 - 18:00",
    lastCharge: "2024-08-18",
  },
];

const initialChargeLog: ChargeLogEntry[] = [
  {
    id: "log-1",
    userId: "m-5",
    userName: "Julieta Ramos",
    coins: 150,
    timestamp: "2024-08-21T10:45:00.000Z",
    note: "Precargado del turno de la mañana",
  },
  {
    id: "log-2",
    userId: "m-2",
    userName: "Lucía Herrera",
    coins: 80,
    timestamp: "2024-08-21T12:15:00.000Z",
  },
  {
    id: "log-3",
    userId: "m-1",
    userName: "Carlos Mendoza",
    coins: 120,
    timestamp: "2024-08-20T17:40:00.000Z",
  },
];

const coinFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export default function CashierDashboardPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [ledger, setLedger] = useState<LedgerMember[]>(initialLedger);
  const [chargeLog, setChargeLog] = useState<ChargeLogEntry[]>(
    initialChargeLog,
  );
  const [pendingCharges, setPendingCharges] = useState<Record<string, string>>({});
  const [rowFeedback, setRowFeedback] = useState<Record<string, string | null>>({});
  const [tierFilter, setTierFilter] = useState<"all" | MembershipTier>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [notes, setNotes] = useState(
    "Confirmar el cajón de efectivo al cierre y sincronizar los totales con finanzas antes de las 7 PM.",
  );
  const [notesMessage, setNotesMessage] = useState<string | null>(null);

  const chargesForSelectedDate = useMemo(
    () =>
      chargeLog.filter((entry) => entry.timestamp.startsWith(selectedDate)),
    [chargeLog, selectedDate],
  );

  const coinsChargedToday = useMemo(
    () =>
      chargesForSelectedDate.reduce((acc, entry) => acc + entry.coins, 0),
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

      if (!searchTerm) {
        return true;
      }

      const normalized = searchTerm.toLowerCase();
      return (
        member.name.toLowerCase().includes(normalized) ||
        member.membership.toLowerCase().includes(normalized)
      );
    });
  }, [ledger, tierFilter, searchTerm]);

  const handleChargeSubmit = (memberId: string) => {
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
    if (!member) {
      return;
    }

    setLedger((prev) =>
      prev.map((item) =>
        item.id === memberId
          ? {
              ...item,
              coinsThisMonth: item.coinsThisMonth + coins,
              lastCharge: selectedDate,
            }
          : item,
      ),
    );

    const timePortion = new Date().toISOString().split("T")[1] ?? "00:00:00.000Z";

    setChargeLog((prev) => [
      {
        id: `log-${Date.now()}`,
        userId: memberId,
        userName: member.name,
        coins,
        timestamp: `${selectedDate}T${timePortion}`,
      },
      ...prev,
    ]);

    setPendingCharges((prev) => ({
      ...prev,
      [memberId]: "",
    }));
    setRowFeedback((prev) => ({
      ...prev,
      [memberId]: `${coinFormatter.format(coins)} monedas registradas`,
    }));
  };

  const handleSaveNotes = () => {
    setNotesMessage("Notas de turno guardadas para el equipo.");
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Operaciones de cajero
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Conciliación diaria de monedas sin problemas
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Registre cada visita de cliente, realice un seguimiento de las monedas entregadas y mantenga un registro instantáneo para finanzas. Los filtros y las notas rápidas ayudan al próximo turno a saber exactamente cómo están las cosas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-background/90">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">
                Tablero de cargos diarios
              </CardTitle>
              <CardDescription>
                Capture las visitas de hoy con solo unos pocos clics. Los montos actualizan el libro mayor al instante.
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

            <div className="overflow-hidden rounded-xl border border-border/60">
              <div className="hidden grid-cols-[2fr_1fr_1fr_1.2fr] bg-muted/40 px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground md:grid">
                <span>Miembro</span>
                <span>Nivel</span>
                <span>Monedas este mes</span>
                <span className="text-right">Registrar cargo</span>
              </div>
              <div className="divide-y divide-border/60">
                {filteredMembers.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                    Ningún miembro coincide con los filtros. Ajuste la búsqueda o el nivel.
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
                        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                          {member.visitWindow}
                        </span>
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

        <div className="space-y-6">
          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">
                Registro de conciliación diaria
              </CardTitle>
              <CardDescription>
                Todas las monedas registradas para la fecha seleccionada aparecen aquí al instante.
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
                        {coinFormatter.format(entry.coins)} monedas • Registrado a las{" "}
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
        </div>
      </div>
    </div>
  );
}
