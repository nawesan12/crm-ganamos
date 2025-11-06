"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Activity,
  Coins,
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
  ContactChannel,
  ContactDirection,
  PaymentMethod,
} from "@/generated/prisma/enums";
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
  return (
    <AuthGuard allowedRoles={["ADMIN", "AGENT"]}>
      <CrmWorkspaceContent />
    </AuthGuard>
  );
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
  const [isPending, startTransition] = useTransition();
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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(() => {
      listClientsAction({ page: 1, pageSize: 50 })
        .then((data) => {
          setClients(data.clients);
        })
        .catch((err) => {
          console.error("Error loading clients", err);
          setError("No pudimos cargar los clientes.");
        });
    });
  }, []);

  const metrics = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((client) => client.status === "ACTIVE").length;
    const balance = clients.reduce((acc, client) => acc + client.pointsBalance, 0);

    return {
      total,
      active,
      balance,
    };
  }, [clients]);

  const handleCreateClient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    if (!newClient.username.trim()) {
      setError("Ingresá un identificador de cliente.");
      return;
    }

    startTransition(() => {
      createClientAction({
        username: newClient.username.trim(),
        phone: newClient.phone.trim() || undefined,
      })
        .then((client) => {
          setClients((prev) => [client, ...prev]);
          setNewClient({ username: "", phone: "" });
          setFeedback(`Cliente ${client.username} creado correctamente.`);
        })
        .catch((err) => {
          console.error("Error creating client", err);
          setError("No se pudo crear el cliente. Revisá que el usuario sea único.");
        });
    });
  };

  const handleLogContact = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    const clientId = Number.parseInt(contactForm.clientId, 10);
    if (!Number.isFinite(clientId)) {
      setError("Seleccioná un cliente para registrar el contacto.");
      return;
    }

    startTransition(() => {
      logContactAction({
        clientId,
        channel: contactForm.channel,
        direction: contactForm.direction,
        viaAd: contactForm.viaAd,
        campaign: undefined,
        message: contactForm.message.trim() || undefined,
      })
        .then(() => {
          setFeedback("Contacto registrado correctamente.");
          setContactForm((prev) => ({
            ...prev,
            message: "",
          }));
        })
        .catch((err) => {
          console.error("Error logging contact", err);
          setError("No se pudo registrar el contacto.");
        });
    });
  };

  const handleRegisterCharge = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    const clientId = Number.parseInt(chargeForm.clientId, 10);
    const amount = Number.parseInt(chargeForm.amount, 10);

    if (!Number.isFinite(clientId)) {
      setError("Seleccioná un cliente para acreditar puntos.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresá un monto válido de puntos.");
      return;
    }

    startTransition(() => {
      registerPointChargeAction({
        clientId,
        amount,
        method: chargeForm.method,
        description: chargeForm.description.trim() || undefined,
        referenceCode: undefined,
        cashierId: undefined,
      })
        .then(({ client }) => {
          setClients((prev) =>
            prev.map((item) =>
              item.id === client.id ? { ...item, pointsBalance: client.pointsBalance } : item,
            ),
          );
          setFeedback("Carga registrada y saldo actualizado.");
          setChargeForm({
            clientId: "",
            amount: "",
            method: PaymentMethod.CASH,
            description: "",
          });
        })
        .catch((err) => {
          console.error("Error registering charge", err);
          setError("No se pudo registrar la carga.");
        });
    });
  };

  const isLoading = isPending && clients.length === 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          CRM operativo
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Seguimiento centralizado de relaciones
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Registrá clientes, documentá interacciones y acreditá puntos desde un solo lugar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Clientes totales"
          value={`${metrics.total}`}
          icon={<Users className="size-5" />}
          description="Registros únicos activos y en seguimiento"
        />
        <MetricCard
          title="Clientes activos"
          value={`${metrics.active}`}
          icon={<Activity className="size-5" />}
          description="Cuentas en estado activo dentro del CRM"
        />
        <MetricCard
          title="Puntos acumulados"
          value={pesoFormatter.format(metrics.balance)}
          icon={<Coins className="size-5" />}
          description="Saldo total disponible en todas las cuentas"
        />
      </div>

      {(feedback || error) && (
        <div
          className={
            "rounded-lg border p-4 text-sm " +
            (error
              ? "border-destructive/60 text-destructive"
              : "border-emerald-500/60 text-emerald-600")
          }
        >
          {feedback ?? error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/70 bg-background/90">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">
              Clientes recientes
            </CardTitle>
            <CardDescription>
              Visibilidad rápida de los registros más activos en el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-muted-foreground">
                Cargando clientes...
              </div>
            ) : clients.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-muted-foreground">
                Aún no se registraron clientes. Creá el primero con el formulario lateral.
              </div>
            ) : (
              clients.slice(0, 8).map((client) => (
                <div
                  key={client.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">{client.username}</p>
                    <p className="text-sm text-muted-foreground">
                      Estado: {client.status.toLowerCase()}
                    </p>
                    {client.phone ? (
                      <p className="text-sm text-muted-foreground">
                        Teléfono: {client.phone}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end text-sm">
                    <span className="font-semibold text-foreground">
                      {pesoFormatter.format(client.pointsBalance)}
                    </span>
                    <span className="text-muted-foreground">Saldo disponible</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
          <CardFooter className="justify-end text-xs text-muted-foreground">
            Datos limitados a los últimos 50 clientes para agilizar la vista.
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Registrar nuevo cliente
              </CardTitle>
              <CardDescription>
                Cargá clientes potenciales o jugadores desde tu canal de ventas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateClient}>
                <div className="space-y-2">
                  <label
                    htmlFor="client-username"
                    className="text-sm font-medium text-foreground"
                  >
                    Usuario / Identificador
                  </label>
                  <Input
                    id="client-username"
                    value={newClient.username}
                    onChange={(event) =>
                      setNewClient((prev) => ({
                        ...prev,
                        username: event.target.value,
                      }))
                    }
                    placeholder="ej. jugador.123"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="client-phone" className="text-sm font-medium text-foreground">
                    Teléfono
                  </label>
                  <Input
                    id="client-phone"
                    value={newClient.phone}
                    onChange={(event) =>
                      setNewClient((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="5491130000000"
                  />
                </div>
                <Button type="submit" disabled={isPending} className="w-full">
                  Crear cliente
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Registrar contacto
              </CardTitle>
              <CardDescription>
                Documentá interacciones clave para mantener el contexto del equipo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleLogContact}>
                <div className="space-y-2">
                  <label
                    htmlFor="contact-client"
                    className="text-sm font-medium text-foreground"
                  >
                    Cliente
                  </label>
                  <select
                    id="contact-client"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={contactForm.clientId}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        clientId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="" disabled>
                      Seleccioná un cliente
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="contact-channel" className="text-sm font-medium text-foreground">
                      Canal
                    </label>
                    <select
                      id="contact-channel"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={contactForm.channel}
                      onChange={(event) =>
                        setContactForm((prev) => ({
                          ...prev,
                          channel: event.target.value as ContactChannel,
                        }))
                      }
                    >
                      {Object.values(ContactChannel).map((channel) => (
                        <option key={channel} value={channel}>
                          {channel.toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-direction" className="text-sm font-medium text-foreground">
                      Dirección
                    </label>
                    <select
                      id="contact-direction"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={contactForm.direction}
                      onChange={(event) =>
                        setContactForm((prev) => ({
                          ...prev,
                          direction: event.target.value as ContactDirection,
                        }))
                      }
                    >
                      {Object.values(ContactDirection).map((direction) => (
                        <option key={direction} value={direction}>
                          {direction.toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={contactForm.viaAd}
                      onChange={(event) =>
                        setContactForm((prev) => ({
                          ...prev,
                          viaAd: event.target.checked,
                        }))
                      }
                      className="size-4 rounded border border-input"
                    />
                    ¿El contacto llegó desde una campaña?
                  </label>
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-message" className="text-sm font-medium text-foreground">
                    Notas
                  </label>
                  <Textarea
                    id="contact-message"
                    value={contactForm.message}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        message: event.target.value,
                      }))
                    }
                    placeholder="Detalle breve de la conversación"
                  />
                </div>
                <Button type="submit" disabled={isPending} className="w-full">
                  Guardar contacto
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/90">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Acreditar puntos
              </CardTitle>
              <CardDescription>
                Actualizá el saldo del cliente directamente desde la gestión comercial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleRegisterCharge}>
                <div className="space-y-2">
                  <label htmlFor="charge-client" className="text-sm font-medium text-foreground">
                    Cliente
                  </label>
                  <select
                    id="charge-client"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={chargeForm.clientId}
                    onChange={(event) =>
                      setChargeForm((prev) => ({
                        ...prev,
                        clientId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="" disabled>
                      Seleccioná un cliente
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="charge-amount" className="text-sm font-medium text-foreground">
                    Monto (puntos)
                  </label>
                  <Input
                    id="charge-amount"
                    type="number"
                    min={1}
                    value={chargeForm.amount}
                    onChange={(event) =>
                      setChargeForm((prev) => ({
                        ...prev,
                        amount: event.target.value,
                      }))
                    }
                    placeholder="500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="charge-method" className="text-sm font-medium text-foreground">
                    Medio de pago
                  </label>
                  <select
                    id="charge-method"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={chargeForm.method}
                    onChange={(event) =>
                      setChargeForm((prev) => ({
                        ...prev,
                        method: event.target.value as PaymentMethod,
                      }))
                    }
                  >
                    {Object.values(PaymentMethod).map((method) => (
                      <option key={method} value={method}>
                        {method.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="charge-description" className="text-sm font-medium text-foreground">
                    Nota interna
                  </label>
                  <Textarea
                    id="charge-description"
                    value={chargeForm.description}
                    onChange={(event) =>
                      setChargeForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Detalle opcional de la acreditación"
                  />
                </div>
                <Button type="submit" disabled={isPending} className="w-full">
                  Registrar acreditación
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
