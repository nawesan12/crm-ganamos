"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  Coins,
  MessageCircle,
  Plus,
  Users,
  Wallet,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useNotification } from "@/lib/useNotification";
import { logger } from "@/lib/logger";

import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { BarComparisonChart } from "@/components/dashboard/bar-comparison-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
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
  ContactChannel,
  ContactDirection,
  PaymentMethod,
} from "@prisma/client";
import { listClientsAction } from "@/actions";
import {
  createClientAction,
  logContactAction,
  registerPointChargeAction,
} from "@/actions/crm";

const pesoFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function CrmWorkspacePage() {
  return <CrmWorkspaceContent />;
}

type ClientRecord = Awaited<ReturnType<typeof listClientsAction>>["clients"][number];

type NewClientForm = {
  username: string;
  phone: string;
};

type ContactFormState = {
  clientId: string;
  channel: ContactChannel;
  direction: ContactDirection;
  viaAd: boolean;
  message: string;
};

type ChargeFormState = {
  clientId: string;
  amount: string;
  method: PaymentMethod;
  description: string;
};

function CrmWorkspaceContent() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [, startTransition] = useTransition();
  const [newClient, setNewClient] = useState<NewClientForm>({
    username: "",
    phone: "",
  });
  const [contactForm, setContactForm] = useState<ContactFormState>({
    clientId: "",
    channel: ContactChannel.WHATSAPP,
    direction: ContactDirection.INBOUND,
    viaAd: false,
    message: "",
  });
  const [chargeForm, setChargeForm] = useState<ChargeFormState>({
    clientId: "",
    amount: "",
    method: PaymentMethod.CASH,
    description: "",
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isChargeDialogOpen, setIsChargeDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isLoggingContact, setIsLoggingContact] = useState(false);
  const [isRegisteringCharge, setIsRegisteringCharge] = useState(false);

  const notification = useNotification();

  useEffect(() => {
    startTransition(() => {
      listClientsAction({ page: 1, pageSize: 50 })
        .then((data) => {
          setClients(data.clients);
        })
        .catch((err) => {
          logger.error("Error loading clients", err);
          notification.error("No pudimos cargar los clientes.");
        });
    });
  }, [notification]);

  const metrics = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((client) => client.status === "ACTIVE").length;
    const balance = clients.reduce((acc, client) => acc + client.pointsBalance, 0);
    return { total, active, balance };
  }, [clients]);

  const topClientsByPoints = useMemo(() => {
    return clients
      .sort((a, b) => b.pointsBalance - a.pointsBalance)
      .slice(0, 5)
      .map((client) => ({
        name: client.username.split('@')[0] || client.username,
        value: client.pointsBalance,
      }));
  }, [clients]);

  const statusDistribution = useMemo(() => {
    const active = clients.filter((c) => c.status === "ACTIVE").length;
    const inactive = clients.length - active;
    return [
      { name: "Activos", value: active, color: "#10b981" },
      { name: "Inactivos", value: inactive, color: "#6b7280" },
    ];
  }, [clients]);

  const sparklineData = useMemo(() => {
    return Array.from({ length: 7 }, () => ({
      value: Math.floor(Math.random() * 5000) + 2000
    }));
  }, []);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.username.toLowerCase().includes(query) ||
        (client.phone && client.phone.includes(query))
    );
  }, [clients, searchQuery]);

  const handleCreateClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newClient.username.trim()) {
      notification.error("Ingresá un identificador de cliente.");
      return;
    }
    if (isCreatingClient) return;

    setIsCreatingClient(true);
    const tempClient: ClientRecord = {
      id: Date.now(),
      username: newClient.username.trim(),
      phone: newClient.phone.trim() || null,
      status: "ACTIVE",
      pointsBalance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketingSourceId: null,
    };

    setClients((prev) => [tempClient, ...prev]);
    setNewClient({ username: "", phone: "" });

    try {
      const client = await createClientAction({
        username: tempClient.username,
        phone: tempClient.phone || undefined,
      });
      setClients((prev) => prev.map((c) => (c.id === tempClient.id ? client : c)));
      notification.success(`Cliente ${client.username} creado.`);
      setIsClientDialogOpen(false);
    } catch (err) {
      logger.error("Error creating client", err);
      setClients((prev) => prev.filter((c) => c.id !== tempClient.id));
      notification.error("Error al crear el cliente.");
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleLogContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactForm.clientId || !contactForm.message.trim()) {
      notification.error("Completá todos los campos requeridos.");
      return;
    }
    if (isLoggingContact) return;

    setIsLoggingContact(true);
    try {
      await logContactAction({
        clientId: Number(contactForm.clientId),
        channel: contactForm.channel,
        direction: contactForm.direction,
        viaAd: contactForm.viaAd,
        message: contactForm.message.trim(),
      });
      notification.success("Contacto registrado correctamente.");
      setContactForm({
        clientId: "",
        channel: ContactChannel.WHATSAPP,
        direction: ContactDirection.INBOUND,
        viaAd: false,
        message: "",
      });
      setIsContactDialogOpen(false);
    } catch (err) {
      logger.error("Error logging contact", err);
      notification.error("Error al registrar el contacto.");
    } finally {
      setIsLoggingContact(false);
    }
  };

  const handleRegisterCharge = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseFloat(chargeForm.amount);
    if (!chargeForm.clientId || !amount || amount <= 0) {
      notification.error("Completá todos los campos correctamente.");
      return;
    }
    if (isRegisteringCharge) return;

    setIsRegisteringCharge(true);
    try {
      const result = await registerPointChargeAction({
        clientId: Number(chargeForm.clientId),
        amount,
        method: chargeForm.method,
        description: chargeForm.description.trim() || undefined,
      });

      setClients((prev) =>
        prev.map((c) =>
          c.id === Number(chargeForm.clientId)
            ? { ...c, pointsBalance: result.client.pointsBalance }
            : c
        )
      );
      notification.success(`Cargo de ${pesoFormatter.format(amount)} registrado.`);
      setChargeForm({
        clientId: "",
        amount: "",
        method: PaymentMethod.CASH,
        description: "",
      });
      setIsChargeDialogOpen(false);
    } catch (err) {
      logger.error("Error registering charge", err);
      notification.error("Error al registrar el cargo.");
    } finally {
      setIsRegisteringCharge(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Panel CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de relaciones con clientes</p>
        </div>
        <Link href="/operator-chat">
          <Button variant="outline" className="gap-2">
            <MessageCircle className="size-4" />
            Chat
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Total clientes"
          value={`${metrics.total}`}
          icon={<Users className="size-5" />}
          trendValue={`${metrics.active} activos`}
          trendDirection="up"
        />
        <MetricCard
          title="Clientes activos"
          value={`${metrics.active}`}
          icon={<Activity className="size-5" />}
          trendValue={`${Math.round((metrics.active / (metrics.total || 1)) * 100)}%`}
          trendDirection={metrics.active > metrics.total / 2 ? "up" : "down"}
        />
        <MetricCard
          title="Saldo de puntos"
          value={pesoFormatter.format(metrics.balance)}
          icon={<Wallet className="size-5" />}
          trendValue="Total acumulado"
          trendDirection="up"
          sparklineData={sparklineData}
          sparklineColor="#8b5cf6"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Top clientes" subtitle="Por saldo de puntos">
          <BarComparisonChart
            data={topClientsByPoints}
            valueFormatter={(value) => pesoFormatter.format(value)}
            height={220}
          />
        </ChartCard>

        <ChartCard title="Estado de clientes" subtitle="Activos vs Inactivos">
          <DonutChart data={statusDistribution} />
        </ChartCard>
      </div>

      <Card className="border-border/70 bg-background/95">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Clientes recientes
          </CardTitle>
          <CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <Search className="size-4" />
              <Input
                placeholder="Buscar por usuario o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 max-w-sm"
              />
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredClients.slice(0, 20).map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 p-3 transition-all hover:border-border/90"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">@{client.username}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    client.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {client.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
              </div>
              <div className="text-right">
                <div className="font-medium text-sm">{pesoFormatter.format(client.pointsBalance)}</div>
                <div className="text-xs text-muted-foreground">Puntos</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {isMenuOpen && (
          <div className="w-64 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Acciones rápidas
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  setIsClientDialogOpen(true);
                  setIsMenuOpen(false);
                }}
              >
                <Plus className="size-4" />
                Nuevo cliente
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  setIsContactDialogOpen(true);
                  setIsMenuOpen(false);
                }}
              >
                <MessageCircle className="size-4" />
                Registrar contacto
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  setIsChargeDialogOpen(true);
                  setIsMenuOpen(false);
                }}
              >
                <Coins className="size-4" />
                Acreditar puntos
              </Button>
            </div>
          </div>
        )}
        <Button
          size="icon-lg"
          className="size-14 rounded-full bg-primary shadow-lg hover:bg-primary/90"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          <Plus className={`size-5 transition-transform ${isMenuOpen ? "rotate-45" : ""}`} />
        </Button>
      </div>

      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nuevo cliente</DialogTitle>
            <DialogDescription>Registra un nuevo cliente en el CRM</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateClient} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Usuario</label>
              <Input
                placeholder="@usuario"
                value={newClient.username}
                onChange={(e) => setNewClient((prev) => ({ ...prev, username: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Teléfono (opcional)</label>
              <Input
                placeholder="+54 9 11 1234-5678"
                value={newClient.phone}
                onChange={(e) => setNewClient((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreatingClient}>
                {isCreatingClient ? "Creando..." : "Crear cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar contacto</DialogTitle>
            <DialogDescription>Documenta una interacción con un cliente</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogContact} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={contactForm.clientId}
                onChange={(e) => setContactForm((prev) => ({ ...prev, clientId: e.target.value }))}
                required
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    @{client.username}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Canal</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={contactForm.channel}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, channel: e.target.value as ContactChannel }))
                  }
                >
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="CALL">Llamada</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dirección</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={contactForm.direction}
                  onChange={(e) =>
                    setContactForm((prev) => ({ ...prev, direction: e.target.value as ContactDirection }))
                  }
                >
                  <option value="INBOUND">Entrante</option>
                  <option value="OUTBOUND">Saliente</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje</label>
              <Textarea
                placeholder="Detalles del contacto..."
                value={contactForm.message}
                onChange={(e) => setContactForm((prev) => ({ ...prev, message: e.target.value }))}
                rows={3}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsContactDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoggingContact}>
                {isLoggingContact ? "Registrando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isChargeDialogOpen} onOpenChange={setIsChargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acreditar puntos</DialogTitle>
            <DialogDescription>Registra un cargo de puntos para un cliente</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegisterCharge} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente</label>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={chargeForm.clientId}
                onChange={(e) => setChargeForm((prev) => ({ ...prev, clientId: e.target.value }))}
                required
              >
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    @{client.username} - {pesoFormatter.format(client.pointsBalance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto</label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={chargeForm.amount}
                  onChange={(e) => setChargeForm((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Método</label>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={chargeForm.method}
                  onChange={(e) =>
                    setChargeForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))
                  }
                >
                  <option value="CASH">Efectivo</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CARD">Tarjeta</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <Input
                placeholder="Concepto del cargo..."
                value={chargeForm.description}
                onChange={(e) => setChargeForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsChargeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isRegisteringCharge}>
                {isRegisteringCharge ? "Procesando..." : "Acreditar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
