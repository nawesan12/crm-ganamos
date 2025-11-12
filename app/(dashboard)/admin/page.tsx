"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarPlus,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Plus,
  UserPlus,
  Users,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  TeamMemberStatus,
  ClientLifecycleStage,
  TeamMember,
  ClientAccount,
  CashierSummary,
  AdminDashboardMetrics,
  getAdminDashboardData,
  addTeamMember,
  addClientAccount,
  addCashier,
} from "@/actions/admin";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export default function AdminDashboardPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <AdminDashboardContent />
    </AuthGuard>
  );
}

function AdminDashboardContent() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [cashiers, setCashiers] = useState<CashierSummary[]>([]);
  const [dashboardMetrics, setDashboardMetrics] =
    useState<AdminDashboardMetrics | null>(null);
  const [isLoadingDashboard, startTransition] = useTransition();
  const [isCreatingCashier, startCashierTransition] = useTransition();
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isCashierDialogOpen, setIsCashierDialogOpen] = useState(false);

  const [userForm, setUserForm] = useState<{
    name: string;
    username: string;
    password: string;
    role: string;
    status: TeamMemberStatus;
  }>({
    name: "",
    username: "",
    password: "",
    role: "",
    status: "En curso",
  });

  const [clientForm, setClientForm] = useState<{
    company: string;
    poc: string;
    email: string;
    stage: ClientLifecycleStage;
    monthlyValue: string;
    onboardingDays: string;
    notes: string;
  }>({
    company: "",
    poc: "",
    email: "",
    stage: "Incorporación",
    monthlyValue: "",
    onboardingDays: "14",
    notes: "",
  });

  const [cashierForm, setCashierForm] = useState({
    name: "",
    username: "",
    password: "",
  });

  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [clientMessage, setClientMessage] = useState<string | null>(null);
  const [cashierMessage, setCashierMessage] = useState<string | null>(null);

  useEffect(() => {
    startTransition(() => {
      getAdminDashboardData()
        .then((data) => {
          setTeamMembers(data.teamMembers);
          setClients(data.clients);
          setCashiers(data.cashiers);
          setDashboardMetrics(data.metrics);
        })
        .catch((error) => {
          console.error("Error loading admin dashboard data", error);
        });
    });
  }, []);

  const onboardingQueue = useMemo(
    () =>
      clients
        .filter((client) => client.stage === "Incorporación")
        .sort((a, b) => b.monthlyValue - a.monthlyValue),
    [clients],
  );

  const clientMetrics = useMemo(() => {
    const totalMonthlyValue = clients.reduce(
      (acc, client) => acc + client.monthlyValue,
      0,
    );

    const onboardingClients = clients.filter(
      (client) => client.stage === "Incorporación",
    );
    const onboardingPipelineValue = onboardingClients.reduce(
      (acc, client) => acc + client.monthlyValue,
      0,
    );

    const totalClients = clients.length;
    const healthyCount = clients.filter(
      (client) => client.health === "Saludable",
    ).length;

    const avgOnboardingTime =
      totalClients > 0
        ? Math.round(
            clients.reduce((acc, client) => acc + client.onboardingDays, 0) /
              totalClients,
          )
        : 0;

    const onboardingDays = clients.map((client) => client.onboardingDays);
    const fastestOnboarding =
      onboardingDays.length > 0 ? Math.min(...onboardingDays) : null;
    const slowestOnboarding =
      onboardingDays.length > 0 ? Math.max(...onboardingDays) : null;

    const newClientsLast30 = clients.filter(
      (client) => client.onboardingDays <= 30,
    ).length;
    const newClientsPrev30 = clients.filter(
      (client) => client.onboardingDays > 30 && client.onboardingDays <= 60,
    ).length;

    return {
      totalMonthlyValue,
      onboardingCount: onboardingClients.length,
      onboardingPipelineValue,
      totalClients,
      healthyCount,
      avgOnboardingTime,
      fastestOnboarding,
      slowestOnboarding,
      newClientsLast30,
      newClientsPrev30,
    };
  }, [clients]);

  const totalMonthlyValue = clientMetrics.totalMonthlyValue;
  const previousMonthlyValue = dashboardMetrics?.previousMonthlyValue ?? 0;
  const monthlyChange = totalMonthlyValue - previousMonthlyValue;
  const monthlyTrendDirection =
    monthlyChange > 0 ? "up" : monthlyChange < 0 ? "down" : "neutral";
  const monthlyTrendValue = dashboardMetrics
    ? monthlyChange === 0
      ? "Sin variación vs 30d previos"
      : `${monthlyChange > 0 ? "▲" : "▼"} ${currency.format(Math.abs(monthlyChange))} vs 30d previos`
    : "Sin datos disponibles";

  const onboardingCount = clientMetrics.onboardingCount;
  const onboardingPipelineValue = clientMetrics.onboardingPipelineValue;
  const newClientsLast30 = clientMetrics.newClientsLast30;
  const newClientsPrev30 = clientMetrics.newClientsPrev30;
  const onboardingTrendDelta = newClientsLast30 - newClientsPrev30;
  const onboardingTrendDirection =
    onboardingTrendDelta > 0
      ? "up"
      : onboardingTrendDelta < 0
        ? "down"
        : "neutral";
  const onboardingTrendValue = `${newClientsLast30} en 30d • ${newClientsPrev30} previos`;

  const healthyCount = clientMetrics.healthyCount;
  const totalClientsCount = clientMetrics.totalClients;
  const healthyRatio =
    totalClientsCount > 0
      ? Math.round((healthyCount / totalClientsCount) * 100)
      : 0;
  const atRiskCount = Math.max(totalClientsCount - healthyCount, 0);
  const healthTrendDirection =
    totalClientsCount === 0 ? "neutral" : healthyRatio >= 86 ? "up" : "down";
  const healthTrendValue = `${healthyCount} saludables / ${atRiskCount} con seguimiento`;

  const avgOnboardingTime = clientMetrics.avgOnboardingTime;
  const fastestOnboarding = clientMetrics.fastestOnboarding;
  const slowestOnboarding = clientMetrics.slowestOnboarding;
  const onboardingRangeLabel =
    fastestOnboarding !== null && slowestOnboarding !== null
      ? `Rango: ${fastestOnboarding}d - ${slowestOnboarding}d`
      : "Sin registros históricos";
  const onboardingSpeedDirection =
    avgOnboardingTime === 0
      ? "neutral"
      : avgOnboardingTime <= 14
        ? "up"
        : "down";

  const sortedCashiers = useMemo(() => {
    return [...cashiers].sort((a, b) => {
      if (b.totalChargedLast30 !== a.totalChargedLast30) {
        return b.totalChargedLast30 - a.totalChargedLast30;
      }

      const dateA = a.lastChargeAt ? new Date(a.lastChargeAt).getTime() : 0;
      const dateB = b.lastChargeAt ? new Date(b.lastChargeAt).getTime() : 0;

      return dateB - dateA;
    });
  }, [cashiers]);

  const totalCashierVolume = useMemo(
    () =>
      cashiers.reduce((acc, cashier) => acc + cashier.totalChargedLast30, 0),
    [cashiers],
  );

  const handleAddUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserMessage(null);

    if (
      !userForm.name ||
      !userForm.username ||
      !userForm.password ||
      !userForm.role
    ) {
      setUserMessage(
        "Completá nombre, usuario, contraseña y rol antes de crear el perfil.",
      );
      return;
    }

    try {
      const newMember = await addTeamMember({
        name: userForm.name.trim(),
        username: userForm.username.trim(),
        password: userForm.password,
        roleLabel: userForm.role.trim(),
        status: userForm.status,
      });

      setTeamMembers((prev) => [newMember, ...prev]);
      setUserForm({
        name: "",
        username: "",
        password: "",
        role: "",
        status: "En curso",
      });
      setUserMessage(`${newMember.name} se agregó al espacio de trabajo.`);
    } catch (error) {
      console.error("Error adding team member", error);
      setUserMessage(
        "No se pudo agregar el compañero de equipo. Intente nuevamente.",
      );
    }
  };

  const handleAddCashier = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCashierMessage(null);

    if (!cashierForm.name || !cashierForm.username || !cashierForm.password) {
      setCashierMessage(
        "Completá nombre, usuario y contraseña temporal para crear el perfil de cajero.",
      );
      return;
    }

    startCashierTransition(async () => {
      try {
        const { teamMember, cashier } = await addCashier({
          name: cashierForm.name.trim(),
          username: cashierForm.username.trim(),
          password: cashierForm.password,
        });

        setTeamMembers((prev) => [teamMember, ...prev]);
        setCashiers((prev) => [cashier, ...prev]);
        setCashierForm({ name: "", username: "", password: "" });
        setCashierMessage(`${cashier.name} ahora puede operar como cajero.`);
      } catch (error) {
        console.error("Error adding cashier", error);
        setCashierMessage("No se pudo crear el cajero. Intente nuevamente.");
      }
    });
  };

  const handleAddClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientMessage(null);

    if (!clientForm.company || !clientForm.poc || !clientForm.email) {
      setClientMessage(
        "Todos los campos de contacto son obligatorios para crear un registro de cliente.",
      );
      return;
    }

    const numericValue = Number(
      clientForm.monthlyValue.replace(/[^0-9.]/g, ""),
    );
    const numericDays = Number(clientForm.onboardingDays);

    try {
      const newClient = await addClientAccount({
        company: clientForm.company.trim(),
        poc: clientForm.poc.trim(),
        email: clientForm.email.trim(),
        stage: clientForm.stage,
        monthlyValue: Number.isFinite(numericValue) ? numericValue : 0,
        onboardingDays: Number.isFinite(numericDays) ? numericDays : 14,
        notes: clientForm.notes.trim() || undefined,
      });

      setClients((prev) => [newClient, ...prev]);
      setClientForm({
        company: "",
        poc: "",
        email: "",
        stage: "Incorporación",
        monthlyValue: "",
        onboardingDays: "14",
        notes: "",
      });
      setClientMessage(
        `${newClient.company} ahora forma parte del pipeline de incorporación.`,
      );
    } catch (error) {
      console.error("Error adding client account", error);
      setClientMessage(
        "No se pudo crear la cuenta de cliente. Intente nuevamente.",
      );
    }
  };

  const handleOpenTeamDialog = () => {
    setIsTeamDialogOpen(true);
    setIsQuickMenuOpen(false);
  };

  const handleOpenClientDialog = () => {
    setIsClientDialogOpen(true);
    setIsQuickMenuOpen(false);
  };

  const handleOpenCashierDialog = () => {
    setIsCashierDialogOpen(true);
    setIsQuickMenuOpen(false);
  };

  const handleTeamDialogChange = (open: boolean) => {
    setIsTeamDialogOpen(open);
    if (!open) {
      setUserMessage(null);
    }
  };

  const handleClientDialogChange = (open: boolean) => {
    setIsClientDialogOpen(open);
    if (!open) {
      setClientMessage(null);
    }
  };

  const handleCashierDialogChange = (open: boolean) => {
    setIsCashierDialogOpen(open);
    if (!open) {
      setCashierMessage(null);
    }
  };

  return (
    <>
      <div className="space-y-10">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Sala de control de administración
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Operaciones de ingresos, de un vistazo
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Manténgase a la vanguardia de la incorporación, el rendimiento del
            equipo y la salud del cliente. Use el menú flotante de acciones para
            ejecutar tareas comunes sin saturar la vista principal.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Ingresos recurrentes mensuales"
            value={currency.format(totalMonthlyValue)}
            icon={<CircleDollarSign className="size-5" />}
            trendLabel="Comparación con 30d previos"
            trendValue={monthlyTrendValue}
            trendDirection={monthlyTrendDirection}
            description="Cargos procesados durante los últimos 30 días"
          />
          <MetricCard
            title="Incorporaciones activas"
            value={`${onboardingCount}`}
            icon={<CalendarPlus className="size-5" />}
            trendLabel="Nuevos clientes (30d)"
            trendValue={onboardingTrendValue}
            trendDirection={onboardingTrendDirection}
            description={`Clientes en incorporación activa • Pipeline ${currency.format(onboardingPipelineValue)}`}
          />
          <MetricCard
            title="Cuentas saludables"
            value={`${healthyRatio}%`}
            icon={<BadgeCheck className="size-5" />}
            trendLabel="Distribución actual"
            trendValue={healthTrendValue}
            trendDirection={healthTrendDirection}
            description="Cuentas marcadas como saludables según actividad reciente"
          />
          <MetricCard
            title="Tiempo promedio de puesta en marcha"
            value={`${avgOnboardingTime} días`}
            icon={<Clock3 className="size-5" />}
            trendLabel="Historial de implementación"
            trendValue={onboardingRangeLabel}
            trendDirection={onboardingSpeedDirection}
            description="Seguimiento de la eficiencia desde la creación hasta la activación (objetivo: < 14 días)"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <div className="space-y-6">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground">
                  Cola de incorporación del equipo
                </CardTitle>
                <CardDescription>
                  Cuentas de mayor valor en la parte superior para enfocar los
                  recursos de implementación.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingDashboard && clients.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                    Cargando datos de cuentas...
                  </div>
                ) : onboardingQueue.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                    No hay cuentas en proceso de incorporación en este momento.
                    Agregue un nuevo cliente para comenzar.
                  </div>
                ) : (
                  onboardingQueue.map((client) => (
                    <div
                      key={client.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/80 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-lg font-medium text-foreground">
                          {client.company}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {client.poc} • {client.email}
                        </span>
                        {client.notes && (
                          <p className="text-sm text-muted-foreground">
                            {client.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex w-full items-center justify-end gap-6 text-sm sm:w-auto">
                        <div className="flex flex-col items-end">
                          <span className="font-medium text-foreground">
                            {currency.format(client.monthlyValue)}
                          </span>
                          <span className="text-muted-foreground">
                            Valor potencial
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-medium text-foreground">
                            {client.onboardingDays} días
                          </span>
                          <span className="text-muted-foreground">
                            En incorporación
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/90">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    Resumen de rendimiento del equipo
                  </CardTitle>
                  <CardDescription>
                    Supervise la carga de acuerdos y la actividad de
                    participación por compañero de equipo.
                  </CardDescription>
                </div>
                <Button variant="outline" className="px-4">
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent className="overflow-hidden rounded-xl border border-border/60">
                <div className="hidden grid-cols-[2fr_1.5fr_1.5fr_1fr] bg-muted/60 px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground sm:grid">
                  <span>Compañero de equipo</span>
                  <span>Rol</span>
                  <span>Última vez activo</span>
                  <span className="text-right">Acuerdos activos</span>
                </div>
                <div className="divide-y divide-border/60">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="grid gap-4 px-6 py-4 text-sm sm:grid-cols-[2fr_1.5fr_1.5fr_1fr] sm:items-center"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {member.name}
                        </span>
                        <span className="text-muted-foreground">
                          @{member.username}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {member.role}
                      </span>
                      <span className="text-muted-foreground">
                        {dateFormatter.format(new Date(member.lastActive))}
                      </span>
                      <span className="text-right font-medium text-foreground">
                        {member.activeDeals}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="size-4" />
                  {teamMembers.length} compañeros de equipo incorporados
                </div>
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="size-4" />
                  {currency.format(
                    clients.reduce(
                      (acc, client) => acc + client.monthlyValue,
                      0,
                    ),
                  )}{" "}
                  en ingresos gestionados
                </div>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/70 bg-background/90">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-foreground">
                  Actividad reciente de cajeros
                </CardTitle>
                <CardDescription>
                  {cashiers.length === 0
                    ? "Todavía no hay cajeros activos."
                    : `${cashiers.length} cajeros activos • ${currency.format(totalCashierVolume)} recaudados en 30 días.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingDashboard && cashiers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                    Cargando registros de cajeros...
                  </div>
                ) : sortedCashiers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                    Todavía no hay cajeros activos. Registrá uno para comenzar a
                    operar.
                  </div>
                ) : (
                  sortedCashiers.map((cashier) => (
                    <div
                      key={cashier.id}
                      className="space-y-4 rounded-xl border border-border/60 bg-background/80 p-5"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-medium text-foreground">
                            {cashier.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            @{cashier.username}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Último cargo{" "}
                          {cashier.lastChargeAt
                            ? dateFormatter.format(
                                new Date(cashier.lastChargeAt),
                              )
                            : "sin registrar"}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Clientes (30d)
                          </p>
                          <p className="text-lg font-semibold text-foreground">
                            {integerFormatter.format(
                              cashier.clientsServedLast30,
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Cargos (30d)
                          </p>
                          <p className="text-lg font-semibold text-foreground">
                            {integerFormatter.format(cashier.chargesLast30)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Monto cargado
                          </p>
                          <p className="text-lg font-semibold text-foreground">
                            {currency.format(cashier.totalChargedLast30)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
              {sortedCashiers.length > 0 && (
                <CardFooter className="justify-between text-sm text-muted-foreground">
                  <span>
                    {sortedCashiers.length}{" "}
                    {sortedCashiers.length === 1
                      ? "cajero activo"
                      : "cajeros activos"}
                  </span>
                  <span className="flex items-center gap-1">
                    Total 30d:
                    <span className="font-medium text-foreground">
                      {currency.format(totalCashierVolume)}
                    </span>
                  </span>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Floating quick actions menu */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {isQuickMenuOpen && (
          <div className="w-64 rounded-2xl border border-border/60 bg-background/95 p-4 shadow-xl backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Acciones rápidas
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ejecutá tareas operativas sin abandonar el panel.
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleOpenTeamDialog}
              >
                <UserPlus className="size-4" />
                Invitar compañero de equipo
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleOpenClientDialog}
              >
                <Building2 className="size-4" />
                Registrar cuenta de cliente
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleOpenCashierDialog}
              >
                <CreditCard className="size-4" />
                Crear cajero
              </Button>
            </div>
          </div>
        )}
        <Button
          size="icon-lg"
          className="rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:bg-primary/90 focus-visible:ring-ring"
          onClick={() => setIsQuickMenuOpen((prev) => !prev)}
          aria-label={
            isQuickMenuOpen
              ? "Cerrar acciones rápidas"
              : "Abrir acciones rápidas"
          }
        >
          <Plus
            className={`size-5 transition-transform ${isQuickMenuOpen ? "rotate-45" : ""}`}
          />
        </Button>
      </div>

      {/* Team member dialog */}
      <Dialog open={isTeamDialogOpen} onOpenChange={handleTeamDialogChange}>
        <DialogContent className="max-h-[90vh] w-full max-w-xl overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle>Invitar un nuevo compañero de equipo</DialogTitle>
            <DialogDescription>
              Asigne credenciales temporales y defina su estado inicial para
              sumarlo al frente comercial.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAddUser}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="name"
                >
                  Nombre completo
                </label>
                <Input
                  id="name"
                  placeholder="Mariana López"
                  value={userForm.name}
                  onChange={(event) =>
                    setUserForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="username"
                >
                  Nombre de usuario
                </label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="mariana.lopez"
                  value={userForm.username}
                  onChange={(event) =>
                    setUserForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="password"
              >
                Contraseña temporal
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Asigna una clave segura"
                value={userForm.password}
                onChange={(event) =>
                  setUserForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="role"
                >
                  Rol dentro del equipo
                </label>
                <Input
                  id="role"
                  placeholder="Ejecutivo comercial"
                  value={userForm.role}
                  onChange={(event) =>
                    setUserForm((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="status"
                >
                  Estado de preparación
                </label>
                <select
                  id="status"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={userForm.status}
                  onChange={(event) =>
                    setUserForm((prev) => ({
                      ...prev,
                      status: event.target.value as TeamMemberStatus,
                    }))
                  }
                >
                  <option value="En curso">En curso</option>
                  <option value="En riesgo">En riesgo</option>
                  <option value="Nuevo ingreso">Nuevo ingreso</option>
                </select>
              </div>
            </div>
            {userMessage && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {userMessage}
              </p>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setUserForm({
                    name: "",
                    username: "",
                    password: "",
                    role: "",
                    status: "En curso",
                  });
                  setUserMessage(null);
                }}
              >
                Limpiar
              </Button>
              <Button type="submit" className="px-6">
                Invitar a compañero de equipo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Client account dialog */}
      <Dialog open={isClientDialogOpen} onOpenChange={handleClientDialogChange}>
        <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle>Registrar cuenta de cliente</DialogTitle>
            <DialogDescription>
              Capturá los datos clave de incorporación para coordinar al equipo
              de éxito.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAddClient}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="company"
                >
                  Nombre de la empresa
                </label>
                <Input
                  id="company"
                  placeholder="Empresa Ejemplo"
                  value={clientForm.company}
                  onChange={(event) =>
                    setClientForm((prev) => ({
                      ...prev,
                      company: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="poc"
                >
                  Punto de contacto
                </label>
                <Input
                  id="poc"
                  placeholder="Nombre y apellido"
                  value={clientForm.poc}
                  onChange={(event) =>
                    setClientForm((prev) => ({
                      ...prev,
                      poc: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="clientEmail"
                >
                  Correo electrónico de contacto
                </label>
                <Input
                  id="clientEmail"
                  type="email"
                  placeholder="contacto@empresa.mx"
                  value={clientForm.email}
                  onChange={(event) =>
                    setClientForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="stage"
                >
                  Etapa del ciclo de vida
                </label>
                <select
                  id="stage"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={clientForm.stage}
                  onChange={(event) =>
                    setClientForm((prev) => ({
                      ...prev,
                      stage: event.target.value as ClientLifecycleStage,
                    }))
                  }
                >
                  <option value="Incorporación">Incorporación</option>
                  <option value="Nutrición">Nutrición</option>
                  <option value="Expansión">Expansión</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="monthlyValue"
                >
                  Valor mensual (USD)
                </label>
                <Input
                  id="monthlyValue"
                  inputMode="decimal"
                  placeholder="4500"
                  value={clientForm.monthlyValue}
                  onChange={(event) =>
                    setClientForm((prev) => ({
                      ...prev,
                      monthlyValue: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="onboardingDays"
                >
                  Días en incorporación
                </label>
                <Input
                  id="onboardingDays"
                  inputMode="numeric"
                  placeholder="14"
                  value={clientForm.onboardingDays}
                  onChange={(event) =>
                    setClientForm((prev) => ({
                      ...prev,
                      onboardingDays: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="notes"
              >
                Notas internas
              </label>
              <Textarea
                id="notes"
                placeholder="Agregá contexto para el equipo de implementación"
                value={clientForm.notes}
                onChange={(event) =>
                  setClientForm((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
                rows={4}
              />
            </div>
            {clientMessage && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {clientMessage}
              </p>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setClientForm({
                    company: "",
                    poc: "",
                    email: "",
                    stage: "Incorporación",
                    monthlyValue: "",
                    onboardingDays: "14",
                    notes: "",
                  });
                  setClientMessage(null);
                }}
              >
                Limpiar
              </Button>
              <Button type="submit" className="px-6">
                Registrar cliente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cashier dialog */}
      <Dialog
        open={isCashierDialogOpen}
        onOpenChange={handleCashierDialogChange}
      >
        <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle>Crear perfil de cajero</DialogTitle>
            <DialogDescription>
              Generá credenciales puntuales para habilitar cobros en punto de
              venta.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAddCashier}>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="cashierName"
              >
                Nombre completo
              </label>
              <Input
                id="cashierName"
                placeholder="p.ej. Valeria Mendoza"
                value={cashierForm.name}
                onChange={(event) =>
                  setCashierForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="cashierUsername"
              >
                Nombre de usuario
              </label>
              <Input
                id="cashierUsername"
                autoComplete="username"
                placeholder="valeria.mendoza"
                value={cashierForm.username}
                onChange={(event) =>
                  setCashierForm((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="cashierPassword"
              >
                Contraseña temporal
              </label>
              <Input
                id="cashierPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Asigna una clave segura"
                value={cashierForm.password}
                onChange={(event) =>
                  setCashierForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                required
              />
            </div>
            {cashierMessage && (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {cashierMessage}
              </p>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCashierForm({ name: "", username: "", password: "" });
                  setCashierMessage(null);
                }}
              >
                Limpiar
              </Button>
              <Button
                type="submit"
                className="px-6"
                disabled={isCreatingCashier}
              >
                {isCreatingCashier ? "Creando..." : "Crear cajero"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
