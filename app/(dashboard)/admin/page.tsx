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
  TrendingUp,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart";
import { BarComparisonChart } from "@/components/dashboard/bar-comparison-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
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

export default function AdminDashboardPage() {
  return <AdminDashboardContent />;
}

function AdminDashboardContent() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [cashiers, setCashiers] = useState<CashierSummary[]>([]);
  const [dashboardMetrics, setDashboardMetrics] =
    useState<AdminDashboardMetrics | null>(null);
  const [, startTransition] = useTransition();
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
          logger.error("Error loading admin dashboard data", error);
        });
    });
  }, []);

  const onboardingQueue = useMemo(
    () =>
      clients
        .filter((client) => client.stage === "Incorporación")
        .sort((a, b) => b.monthlyValue - a.monthlyValue)
        .slice(0, 5),
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

  const revenueTrendData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dayClients = clients.filter((c) => c.onboardingDays <= 30 + i * 2);
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: dayClients.reduce((acc, c) => acc + c.monthlyValue, 0),
      };
    });
    return last7Days;
  }, [clients]);

  const sparklineData = useMemo(() => {
    return Array.from({ length: 14 }, () => ({
      value: Math.floor(Math.random() * 50000) + 100000
    }));
  }, []);

  const teamPerformanceData = useMemo(() => {
    return teamMembers
      .sort((a, b) => b.activeDeals - a.activeDeals)
      .slice(0, 5)
      .map((member) => ({
        name: member.name.split(' ')[0],
        value: member.activeDeals,
        color: member.activeDeals > 5 ? '#8b5cf6' : '#a78bfa',
      }));
  }, [teamMembers]);

  const cashierPerformanceData = useMemo(() => {
    return cashiers
      .sort((a, b) => b.totalChargedLast30 - a.totalChargedLast30)
      .slice(0, 5)
      .map((cashier) => ({
        name: cashier.name.split(' ')[0],
        value: cashier.totalChargedLast30,
      }));
  }, [cashiers]);

  const healthDistributionData = useMemo(() => {
    const healthyCount = clients.filter((c) => c.health === "Saludable").length;
    const atRiskCount = clients.length - healthyCount;
    return [
      { name: "Saludables", value: healthyCount, color: "#10b981" },
      { name: "En seguimiento", value: atRiskCount, color: "#f59e0b" },
    ];
  }, [clients]);

  const totalMonthlyValue = clientMetrics.totalMonthlyValue;
  const previousMonthlyValue = dashboardMetrics?.previousMonthlyValue ?? 0;
  const monthlyChange = totalMonthlyValue - previousMonthlyValue;
  const monthlyTrendDirection =
    monthlyChange > 0 ? "up" : monthlyChange < 0 ? "down" : "neutral";
  const monthlyTrendValue =
    monthlyChange === 0
      ? "Sin cambios"
      : `${monthlyChange > 0 ? "+" : ""}${currency.format(monthlyChange)}`;

  const onboardingCount = clientMetrics.onboardingCount;
  const newClientsLast30 = clientMetrics.newClientsLast30;
  const newClientsPrev30 = clientMetrics.newClientsPrev30;
  const onboardingTrendDelta = newClientsLast30 - newClientsPrev30;
  const onboardingTrendDirection =
    onboardingTrendDelta > 0
      ? "up"
      : onboardingTrendDelta < 0
        ? "down"
        : "neutral";
  const onboardingTrendValue = `${onboardingTrendDelta >= 0 ? "+" : ""}${onboardingTrendDelta} este mes`;

  const healthyCount = clientMetrics.healthyCount;
  const totalClientsCount = clientMetrics.totalClients;
  const healthyRatio =
    totalClientsCount > 0
      ? Math.round((healthyCount / totalClientsCount) * 100)
      : 0;
  const healthTrendDirection = healthyRatio >= 86 ? "up" : "down";
  const healthTrendValue = `${healthyCount}/${totalClientsCount} cuentas`;

  const avgOnboardingTime = clientMetrics.avgOnboardingTime;
  const onboardingSpeedDirection = avgOnboardingTime <= 14 ? "up" : "down";
  const onboardingSpeedValue = avgOnboardingTime <= 14 ? "Dentro del objetivo" : "Por encima del objetivo";

  const handleAddUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserMessage(null);

    if (
      !userForm.name ||
      !userForm.username ||
      !userForm.password ||
      !userForm.role
    ) {
      setUserMessage("Completá todos los campos antes de crear el perfil.");
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
      setUserMessage("Compañero de equipo agregado exitosamente.");
    } catch (error) {
      logger.error("Error adding team member", error);
      setUserMessage("Error al agregar compañero de equipo.");
    }
  };

  const handleAddClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientMessage(null);

    if (!clientForm.company || !clientForm.poc || !clientForm.email || !clientForm.monthlyValue) {
      setClientMessage("Completá los campos requeridos.");
      return;
    }

    try {
      const newClient = await addClientAccount({
        company: clientForm.company.trim(),
        poc: clientForm.poc.trim(),
        email: clientForm.email.trim(),
        stage: clientForm.stage,
        monthlyValue: parseFloat(clientForm.monthlyValue),
        onboardingDays: parseInt(clientForm.onboardingDays, 10),
        notes: clientForm.notes.trim(),
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
      setClientMessage("Cliente agregado exitosamente.");
    } catch (error) {
      logger.error("Error adding client", error);
      setClientMessage("Error al agregar cliente.");
    }
  };

  const handleAddCashier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCashierMessage(null);

    if (!cashierForm.name || !cashierForm.username || !cashierForm.password) {
      setCashierMessage("Completá todos los campos.");
      return;
    }

    try {
      const result = await addCashier({
        name: cashierForm.name.trim(),
        username: cashierForm.username.trim(),
        password: cashierForm.password,
      });

      setCashiers((prev) => [result.cashier, ...prev]);
      setCashierForm({
        name: "",
        username: "",
        password: "",
      });
      setCashierMessage("Cajero creado exitosamente.");
    } catch (error) {
      logger.error("Error adding cashier", error);
      setCashierMessage("Error al crear cajero.");
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
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Panel de Administración</h1>
          <p className="text-sm text-muted-foreground">Operaciones de ingresos de un vistazo</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Ingresos mensuales"
            value={currency.format(totalMonthlyValue)}
            icon={<CircleDollarSign className="size-5" />}
            trendValue={monthlyTrendValue}
            trendDirection={monthlyTrendDirection}
            sparklineData={sparklineData}
            sparklineColor="#8b5cf6"
          />
          <MetricCard
            title="En incorporación"
            value={`${onboardingCount}`}
            icon={<CalendarPlus className="size-5" />}
            trendValue={onboardingTrendValue}
            trendDirection={onboardingTrendDirection}
            description={`Pipeline ${currency.format(clientMetrics.onboardingPipelineValue)}`}
          />
          <MetricCard
            title="Salud de cuentas"
            value={`${healthyRatio}%`}
            icon={<BadgeCheck className="size-5" />}
            trendValue={healthTrendValue}
            trendDirection={healthTrendDirection}
          />
          <MetricCard
            title="Tiempo de activación"
            value={`${avgOnboardingTime}d`}
            icon={<Clock3 className="size-5" />}
            trendValue={onboardingSpeedValue}
            trendDirection={onboardingSpeedDirection}
            description="Objetivo: <14 días"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="Tendencia de ingresos" subtitle="Últimos 7 días">
            <RevenueTrendChart data={revenueTrendData} />
          </ChartCard>

          <ChartCard title="Distribución de salud" subtitle="Estado de cuentas">
            <DonutChart data={healthDistributionData} />
          </ChartCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartCard title="Top performers" subtitle="Acuerdos activos por miembro">
            <BarComparisonChart
              data={teamPerformanceData}
              valueFormatter={(value) => value.toString()}
              height={220}
            />
          </ChartCard>

          <ChartCard title="Rendimiento de cajeros" subtitle="Volumen últimos 30 días">
            <BarComparisonChart
              data={cashierPerformanceData}
              valueFormatter={(value) => currency.format(value)}
              height={220}
            />
          </ChartCard>
        </div>

        {onboardingQueue.length > 0 && (
          <Card className="border-border/70 bg-background/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                Pipeline de incorporación
              </CardTitle>
              <CardDescription>Top 5 cuentas por valor mensual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {onboardingQueue.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 p-4 transition-all hover:border-border/90 hover:bg-background/95"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{client.company}</span>
                    <span className="text-sm text-muted-foreground">{client.poc}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="font-medium">{currency.format(client.monthlyValue)}</div>
                      <div className="text-muted-foreground">Valor</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{client.onboardingDays}d</div>
                      <div className="text-muted-foreground">Días</div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {isQuickMenuOpen && (
          <div className="w-64 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Acciones rápidas
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleOpenTeamDialog}
              >
                <UserPlus className="size-4" />
                Agregar miembro
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={handleOpenClientDialog}
              >
                <Building2 className="size-4" />
                Nuevo cliente
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
          className="size-14 rounded-full bg-primary shadow-lg hover:bg-primary/90"
          onClick={() => setIsQuickMenuOpen((prev) => !prev)}
        >
          <Plus className={`size-5 transition-transform ${isQuickMenuOpen ? "rotate-45" : ""}`} />
        </Button>
      </div>

      <Dialog open={isTeamDialogOpen} onOpenChange={handleTeamDialogChange}>
        <DialogContent className="max-h-[90vh] w-full max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar miembro de equipo</DialogTitle>
            <DialogDescription>Crea credenciales para un nuevo compañero</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAddUser}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="name">Nombre completo</label>
                <Input
                  id="name"
                  placeholder="Mariana López"
                  value={userForm.name}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="username">Usuario</label>
                <Input
                  id="username"
                  placeholder="mariana.lopez"
                  value={userForm.username}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">Contraseña</label>
              <Input
                id="password"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="role">Rol</label>
                <Input
                  id="role"
                  placeholder="Ejecutivo comercial"
                  value={userForm.role}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="status">Estado</label>
                <select
                  id="status"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={userForm.status}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, status: e.target.value as TeamMemberStatus }))}
                >
                  <option value="En curso">En curso</option>
                  <option value="En riesgo">En riesgo</option>
                  <option value="Nuevo ingreso">Nuevo ingreso</option>
                </select>
              </div>
            </div>
            {userMessage && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{userMessage}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsTeamDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear miembro</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isClientDialogOpen} onOpenChange={handleClientDialogChange}>
        <DialogContent className="max-h-[90vh] w-full max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar cliente</DialogTitle>
            <DialogDescription>Agrega una nueva cuenta de cliente</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAddClient}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="company">Empresa</label>
              <Input
                id="company"
                value={clientForm.company}
                onChange={(e) => setClientForm((prev) => ({ ...prev, company: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="poc">Contacto</label>
                <Input
                  id="poc"
                  value={clientForm.poc}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, poc: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">Email</label>
                <Input
                  id="email"
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="monthlyValue">Valor mensual</label>
                <Input
                  id="monthlyValue"
                  type="number"
                  value={clientForm.monthlyValue}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, monthlyValue: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="stage">Etapa</label>
                <select
                  id="stage"
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={clientForm.stage}
                  onChange={(e) => setClientForm((prev) => ({ ...prev, stage: e.target.value as ClientLifecycleStage }))}
                >
                  <option value="Incorporación">Incorporación</option>
                  <option value="Activo">Activo</option>
                  <option value="En riesgo">En riesgo</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="notes">Notas</label>
              <Textarea
                id="notes"
                value={clientForm.notes}
                onChange={(e) => setClientForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
            {clientMessage && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{clientMessage}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear cliente</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCashierDialogOpen} onOpenChange={handleCashierDialogChange}>
        <DialogContent className="max-h-[90vh] w-full max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear cajero</DialogTitle>
            <DialogDescription>Configura un nuevo cajero</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAddCashier}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="cashier-name">Nombre</label>
              <Input
                id="cashier-name"
                value={cashierForm.name}
                onChange={(e) => setCashierForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="cashier-username">Usuario</label>
              <Input
                id="cashier-username"
                value={cashierForm.username}
                onChange={(e) => setCashierForm((prev) => ({ ...prev, username: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="cashier-password">Contraseña</label>
              <Input
                id="cashier-password"
                type="password"
                value={cashierForm.password}
                onChange={(e) => setCashierForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>
            {cashierMessage && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{cashierMessage}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCashierDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear cajero</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
