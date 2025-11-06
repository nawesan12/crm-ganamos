// app/(dashboard)/admin/page.tsx (o donde tengas este componente)
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BadgeCheck,
  CalendarPlus,
  CircleDollarSign,
  Clock3,
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
  TeamMemberStatus,
  ClientLifecycleStage,
  TeamMember,
  ClientAccount,
  getAdminDashboardData,
  addTeamMember,
  addClientAccount,
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
  const [isPending, startTransition] = useTransition();

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

  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [clientMessage, setClientMessage] = useState<string | null>(null);

  // Cargar datos iniciales
  useEffect(() => {
    startTransition(() => {
      getAdminDashboardData()
        .then((data) => {
          setTeamMembers(data.teamMembers);
          setClients(data.clients);
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

  const metrics = useMemo(() => {
    const totalMonthlyValue = clients.reduce(
      (acc, client) => acc + client.monthlyValue,
      0,
    );
    const onboardingCount = clients.filter(
      (client) => client.stage === "Incorporación",
    ).length;
    const healthyRatio = Math.round(
      (clients.filter((client) => client.health === "Saludable").length /
        Math.max(clients.length, 1)) *
        100,
    );
    const avgOnboardingTime = Math.round(
      clients.reduce((acc, client) => acc + client.onboardingDays, 0) /
        Math.max(clients.length, 1),
    );

    return {
      totalMonthlyValue,
      onboardingCount,
      healthyRatio,
      avgOnboardingTime,
    };
  }, [clients]);

  const handleAddUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserMessage(null);

    if (!userForm.name || !userForm.username || !userForm.password || !userForm.role) {
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

  return (
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
          equipo y la salud del cliente. Utilice los formularios a continuación
          para incorporar compañeros de equipo y nuevas cuentas sin salir de la
          vista de análisis.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Ingresos recurrentes mensuales"
          value={currency.format(metrics.totalMonthlyValue)}
          icon={<CircleDollarSign className="size-5" />}
          trendLabel="Últimos 30 días"
          trendValue="▲ 12% vs ciclo anterior"
          trendDirection="up"
          description="Suma de todos los contratos de suscripción activos"
        />
        <MetricCard
          title="Incorporaciones activas"
          value={`${metrics.onboardingCount}`}
          icon={<CalendarPlus className="size-5" />}
          trendLabel="Equipos por lanzar"
          trendValue="3 inicios programados"
          description="Clientes en etapa de incorporación"
        />
        <MetricCard
          title="Cuentas saludables"
          value={`${metrics.healthyRatio}%`}
          icon={<BadgeCheck className="size-5" />}
          trendLabel="Salud del cliente"
          trendValue="Objetivo del 86%"
          trendDirection={metrics.healthyRatio >= 86 ? "up" : "down"}
          description="Cuentas marcadas en verde durante la última revisión"
        />
        <MetricCard
          title="Tiempo promedio de puesta en marcha"
          value={`${metrics.avgOnboardingTime} días`}
          icon={<Clock3 className="size-5" />}
          trendLabel="Desde la firma hasta la activación"
          trendValue="Objetivo: < 14 días"
          trendDirection={metrics.avgOnboardingTime <= 14 ? "up" : "down"}
          description="Seguimiento de la eficiencia de la implementación en todas las cuentas"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
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
            {isPending && clients.length === 0 ? (
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form equipo */}
        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">
              Agregar un compañero de equipo
            </CardTitle>
            <CardDescription>
              Proporcione acceso a especialistas en ventas, éxito o
              implementación.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    placeholder="p.ej. Fernanda Ruiz"
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
                    placeholder="fernanda.ruiz"
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
                    placeholder="Generá una contraseña segura"
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
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor="role"
                  >
                    Rol
                  </label>
                  <Input
                    id="role"
                    placeholder="Éxito del cliente"
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
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="reset"
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
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Form cliente */}
        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">
              Agregar una cuenta de cliente
            </CardTitle>
            <CardDescription>
              Capture el contexto de la puesta en marcha para que el equipo de
              éxito pueda dar seguimiento.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  Notas para el equipo
                </label>
                <Textarea
                  id="notes"
                  placeholder="Contexto, bloqueadores o próximos pasos"
                  value={clientForm.notes}
                  onChange={(event) =>
                    setClientForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
              {clientMessage && (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  {clientMessage}
                </p>
              )}
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="reset"
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
                  Crear cliente
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-background/90">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">
              Resumen de rendimiento del equipo
            </CardTitle>
            <CardDescription>
              Supervise la carga de acuerdos y la actividad de participación por
              compañero de equipo.
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
                  <span className="text-muted-foreground">@{member.username}</span>
                </div>
                <span className="text-muted-foreground">{member.role}</span>
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
              clients.reduce((acc, client) => acc + client.monthlyValue, 0),
            )}{" "}
            en ingresos gestionados
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
