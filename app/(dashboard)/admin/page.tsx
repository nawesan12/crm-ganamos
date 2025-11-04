"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  CalendarPlus,
  CircleDollarSign,
  Clock3,
  Target,
  TrendingUp,
  Users,
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

type TeamMemberStatus = "On track" | "At risk" | "New hire";

type ClientLifecycleStage = "Onboarding" | "Nurturing" | "Expansion";

type ClientHealthStatus = "Healthy" | "Needs attention" | "At risk";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: TeamMemberStatus;
  activeDeals: number;
  lastActive: string;
};

type ClientAccount = {
  id: string;
  company: string;
  poc: string;
  email: string;
  stage: ClientLifecycleStage;
  monthlyValue: number;
  health: ClientHealthStatus;
  lastInteraction: string;
  onboardingDays: number;
  notes?: string;
};

const initialTeamMembers: TeamMember[] = [
  {
    id: "tm-1",
    name: "Laura Sánchez",
    email: "laura.sanchez@ganamos.mx",
    role: "Account Executive",
    status: "On track",
    activeDeals: 6,
    lastActive: "2024-08-21",
  },
  {
    id: "tm-2",
    name: "Héctor Flores",
    email: "hector.flores@ganamos.mx",
    role: "Customer Success",
    status: "At risk",
    activeDeals: 3,
    lastActive: "2024-08-18",
  },
  {
    id: "tm-3",
    name: "Rocío Andrade",
    email: "rocio.andrade@ganamos.mx",
    role: "Implementation Lead",
    status: "On track",
    activeDeals: 4,
    lastActive: "2024-08-20",
  },
];

const initialClients: ClientAccount[] = [
  {
    id: "cl-1",
    company: "Soluciones Rivera",
    poc: "Daniel Rivera",
    email: "daniel@solucionesrivera.mx",
    stage: "Onboarding",
    monthlyValue: 4200,
    health: "Healthy",
    lastInteraction: "2024-08-19",
    onboardingDays: 9,
    notes: "Waiting for billing integration",
  },
  {
    id: "cl-2",
    company: "Grupo Atalaya",
    poc: "María José Torres",
    email: "maria.torres@grupotalaya.mx",
    stage: "Expansion",
    monthlyValue: 6800,
    health: "Healthy",
    lastInteraction: "2024-08-17",
    onboardingDays: 15,
    notes: "Interested in analytics add-on",
  },
  {
    id: "cl-3",
    company: "Mercado Verde",
    poc: "Luis Rivas",
    email: "luis.rivas@mercadoverde.mx",
    stage: "Nurturing",
    monthlyValue: 2900,
    health: "Needs attention",
    lastInteraction: "2024-08-15",
    onboardingDays: 21,
    notes: "Delays signing data processing agreement",
  },
];

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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(
    initialTeamMembers,
  );
  const [clients, setClients] = useState<ClientAccount[]>(initialClients);
  const [userForm, setUserForm] = useState<{
    name: string;
    email: string;
    role: string;
    status: TeamMemberStatus;
  }>({
    name: "",
    email: "",
    role: "",
    status: "On track",
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
    stage: "Onboarding",
    monthlyValue: "",
    onboardingDays: "14",
    notes: "",
  });
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [clientMessage, setClientMessage] = useState<string | null>(null);

  const onboardingQueue = useMemo(
    () =>
      clients
        .filter((client) => client.stage === "Onboarding")
        .sort((a, b) => b.monthlyValue - a.monthlyValue),
    [clients],
  );

  const metrics = useMemo(() => {
    const totalMonthlyValue = clients.reduce(
      (acc, client) => acc + client.monthlyValue,
      0,
    );
    const onboardingCount = clients.filter(
      (client) => client.stage === "Onboarding",
    ).length;
    const healthyRatio = Math.round(
      (clients.filter((client) => client.health === "Healthy").length /
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

  const handleAddUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.role) {
      setUserMessage("Complete every required field before creating the profile.");
      return;
    }

    const newUser: TeamMember = {
      id: `tm-${Date.now()}`,
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      role: userForm.role.trim(),
      status: userForm.status,
      activeDeals: 0,
      lastActive: new Date().toISOString().slice(0, 10),
    };

    setTeamMembers((prev) => [newUser, ...prev]);
    setUserForm({ name: "", email: "", role: "", status: "On track" });
    setUserMessage(`${newUser.name} was added to the workspace.`);
  };

  const handleAddClient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clientForm.company || !clientForm.poc || !clientForm.email) {
      setClientMessage("All contact fields are required to create a client record.");
      return;
    }

    const numericValue = Number(
      clientForm.monthlyValue.replace(/[^0-9.]/g, ""),
    );
    const numericDays = Number(clientForm.onboardingDays);

    const newClient: ClientAccount = {
      id: `cl-${Date.now()}`,
      company: clientForm.company.trim(),
      poc: clientForm.poc.trim(),
      email: clientForm.email.trim(),
      stage: clientForm.stage,
      monthlyValue: Number.isFinite(numericValue) ? numericValue : 0,
      health: "Healthy",
      lastInteraction: new Date().toISOString().slice(0, 10),
      onboardingDays: Number.isFinite(numericDays) ? numericDays : 12,
      notes: clientForm.notes.trim() ? clientForm.notes.trim() : undefined,
    };

    setClients((prev) => [newClient, ...prev]);
    setClientForm({
      company: "",
      poc: "",
      email: "",
      stage: "Onboarding",
      monthlyValue: "",
      onboardingDays: "14",
      notes: "",
    });
    setClientMessage(
      `${newClient.company} is now part of the onboarding pipeline.`,
    );
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Admin control room
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Revenue operations, at a glance
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Stay ahead of onboarding, team performance, and client health. Use the
          forms below to onboard teammates and new accounts without leaving the
          analytics view.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Monthly recurring revenue"
          value={currency.format(metrics.totalMonthlyValue)}
          icon={<CircleDollarSign className="size-5" />}
          trendLabel="Rolling 30 days"
          trendValue="▲ 12% vs last cycle"
          trendDirection="up"
          description="Sum of all active subscription contracts"
        />
        <MetricCard
          title="Active onboardings"
          value={`${metrics.onboardingCount}`}
          icon={<CalendarPlus className="size-5" />}
          trendLabel="Teams to launch"
          trendValue="3 kickoffs scheduled"
          description="Clients in onboarding stage"
        />
        <MetricCard
          title="Healthy accounts"
          value={`${metrics.healthyRatio}%`}
          icon={<BadgeCheck className="size-5" />}
          trendLabel="Customer health"
          trendValue="86% target"
          trendDirection={metrics.healthyRatio >= 86 ? "up" : "down"}
          description="Accounts marked green during the last review"
        />
        <MetricCard
          title="Average go-live time"
          value={`${metrics.avgOnboardingTime} days`}
          icon={<Clock3 className="size-5" />}
          trendLabel="From signature to activation"
          trendValue="Goal: < 14 days"
          trendDirection={metrics.avgOnboardingTime <= 14 ? "up" : "down"}
          description="Track implementation efficiency across accounts"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">
              Team onboarding queue
            </CardTitle>
            <CardDescription>
              Highest value accounts at the top to focus implementation resources.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {onboardingQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                No onboarding accounts at the moment. Add a new client to get
                started.
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
                        Value potential
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-medium text-foreground">
                        {client.onboardingDays} days
                      </span>
                      <span className="text-muted-foreground">In onboarding</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">
              Weekly highlights
            </CardTitle>
            <CardDescription>
              Quick wins and risks to share with leadership.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-4">
              <TrendingUp className="mt-0.5 size-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Expansion opportunity with Grupo Atalaya
                </p>
                <p className="text-sm text-muted-foreground">
                  They requested pricing for analytics seats. Prepare proposal
                  before Thursday&rsquo;s QBR.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-4">
              <Target className="mt-0.5 size-5 text-amber-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Mercado Verde requires an executive touchpoint
                </p>
                <p className="text-sm text-muted-foreground">
                  Implementation blocked by legal review. Schedule leadership
                  call to unblock contract.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/40 p-4">
              <Activity className="mt-0.5 size-5 text-emerald-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  New health survey launched
                </p>
                <p className="text-sm text-muted-foreground">
                  Send pulse survey to top 20 accounts and review insights on
                  Monday&rsquo;s sync.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">
              Add a teammate
            </CardTitle>
            <CardDescription>
              Provision access for sales, success, or implementation specialists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleAddUser}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="name">
                    Full name
                  </label>
                  <Input
                    id="name"
                    placeholder="e.g. Fernanda Ruiz"
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
                  <label className="text-sm font-medium text-foreground" htmlFor="email">
                    Work email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="fernanda@ganamos.mx"
                    value={userForm.email}
                    onChange={(event) =>
                      setUserForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="role">
                    Role
                  </label>
                  <Input
                    id="role"
                    placeholder="Customer Success"
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
                  <label className="text-sm font-medium text-foreground" htmlFor="status">
                    Ramp status
                  </label>
                  <select
                    id="status"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={userForm.status}
                    onChange={(event) =>
                      setUserForm((prev) => ({
                        ...prev,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="On track">On track</option>
                    <option value="At risk">At risk</option>
                    <option value="New hire">New hire</option>
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
                      email: "",
                      role: "",
                      status: "On track",
                    });
                    setUserMessage(null);
                  }}
                >
                  Clear
                </Button>
                <Button type="submit" className="px-6">
                  Invite teammate
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">
              Add a client account
            </CardTitle>
            <CardDescription>
              Capture go-live context so the success team can follow through.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleAddClient}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="company">
                    Company name
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
                  <label className="text-sm font-medium text-foreground" htmlFor="poc">
                    Point of contact
                  </label>
                  <Input
                    id="poc"
                    placeholder="Name and last name"
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
                  <label className="text-sm font-medium text-foreground" htmlFor="clientEmail">
                    Contact email
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
                  <label className="text-sm font-medium text-foreground" htmlFor="stage">
                    Lifecycle stage
                  </label>
                  <select
                    id="stage"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={clientForm.stage}
                    onChange={(event) =>
                      setClientForm((prev) => ({
                        ...prev,
                        stage: event.target.value,
                      }))
                    }
                  >
                    <option value="Onboarding">Onboarding</option>
                    <option value="Nurturing">Nurturing</option>
                    <option value="Expansion">Expansion</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="monthlyValue">
                    Monthly value (USD)
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
                  <label className="text-sm font-medium text-foreground" htmlFor="onboardingDays">
                    Days in onboarding
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
                <label className="text-sm font-medium text-foreground" htmlFor="notes">
                  Notes for the team
                </label>
                <Textarea
                  id="notes"
                  placeholder="Context, blockers, or next steps"
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
                      stage: "Onboarding",
                      monthlyValue: "",
                      onboardingDays: "14",
                      notes: "",
                    });
                    setClientMessage(null);
                  }}
                >
                  Clear
                </Button>
                <Button type="submit" className="px-6">
                  Create client
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
              Team performance snapshot
            </CardTitle>
            <CardDescription>
              Monitor deal load and engagement activity per teammate.
            </CardDescription>
          </div>
          <Button variant="outline" className="px-4">
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-xl border border-border/60">
          <div className="hidden grid-cols-[2fr_1.5fr_1.5fr_1fr] bg-muted/60 px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground sm:grid">
            <span>Teammate</span>
            <span>Role</span>
            <span>Last active</span>
            <span className="text-right">Active deals</span>
          </div>
          <div className="divide-y divide-border/60">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="grid gap-4 px-6 py-4 text-sm sm:grid-cols-[2fr_1.5fr_1.5fr_1fr] sm:items-center"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{member.name}</span>
                  <span className="text-muted-foreground">{member.email}</span>
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
            {teamMembers.length} teammates onboarded
          </div>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="size-4" />
            {currency.format(
              clients.reduce((acc, client) => acc + client.monthlyValue, 0),
            )}{" "}
            in managed revenue
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
