// app/(dashboard)/admin/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { TransactionType, UserRole } from "@/generated/prisma/enums";

// ---- Tipos del dashboard (VIEW MODELS, no son el schema) ----

export type TeamMemberStatus = "En curso" | "En riesgo" | "Nuevo ingreso";

export type ClientLifecycleStage = "Incorporación" | "Nutrición" | "Expansión";

export type ClientHealthStatus =
  | "Saludable"
  | "Necesita atención"
  | "En riesgo";

export type TeamMember = {
  id: string; // tm-<userId>
  name: string;
  email: string;
  role: string; // label amigable
  status: TeamMemberStatus;
  activeDeals: number;
  lastActive: string; // YYYY-MM-DD
};

export type ClientAccount = {
  id: string; // cl-<clientId>
  company: string; // label de UI, derivado de username o del form
  poc: string; // label de UI
  email: string; // label de UI (no se guarda)
  stage: ClientLifecycleStage;
  monthlyValue: number;
  health: ClientHealthStatus;
  lastInteraction: string; // YYYY-MM-DD
  onboardingDays: number;
  notes?: string;
};

// ---- Helpers ----

function diffDays(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function mapUserRoleToLabel(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "CASHIER":
      return "Cajero";
    case "AGENT":
      return "Agente";
    default:
      return role;
  }
}

// ---- Carga del dashboard ----

export async function getAdminDashboardData(): Promise<{
  teamMembers: TeamMember[];
  clients: ClientAccount[];
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const [users, clients, recentCharges, recentContacts] = await Promise.all([
    prisma.user.findMany(),
    prisma.client.findMany(), // usa sólo campos del schema: id, createdAt, updatedAt, username, etc.
    prisma.pointTransaction.findMany({
      where: {
        type: TransactionType.CHARGE,
        createdAt: { gte: ninetyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientContact.findMany({
      where: {
        createdAt: { gte: ninetyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // ---- Stats por cliente (última carga, total últimos 30 días, última interacción) ----
  type ClientStats = {
    lastChargeAt?: Date;
    totalChargedLast30: number;
    lastInteractionAt?: Date;
  };

  const clientStats = new Map<number, ClientStats>();

  for (const tx of recentCharges) {
    const stats = clientStats.get(tx.clientId) ?? {
      totalChargedLast30: 0,
    };

    if (!stats.lastChargeAt || tx.createdAt > stats.lastChargeAt) {
      stats.lastChargeAt = tx.createdAt;
    }

    if (tx.createdAt >= thirtyDaysAgo) {
      stats.totalChargedLast30 += tx.amount;
    }

    if (!stats.lastInteractionAt || tx.createdAt > stats.lastInteractionAt) {
      stats.lastInteractionAt = tx.createdAt;
    }

    clientStats.set(tx.clientId, stats);
  }

  for (const contact of recentContacts) {
    const stats = clientStats.get(contact.clientId) ?? {
      totalChargedLast30: 0,
    };

    if (
      !stats.lastInteractionAt ||
      contact.createdAt > stats.lastInteractionAt
    ) {
      stats.lastInteractionAt = contact.createdAt;
    }

    clientStats.set(contact.clientId, stats);
  }

  // ---- Stats por usuario (actividad y deals activos) ----
  type UserStats = {
    lastActiveAt?: Date;
    activeClientIds: Set<number>;
  };

  const userStats = new Map<number, UserStats>();

  for (const tx of recentCharges) {
    if (!tx.cashierId) continue;

    const stats = userStats.get(tx.cashierId) ?? {
      activeClientIds: new Set<number>(),
    };

    if (!stats.lastActiveAt || tx.createdAt > stats.lastActiveAt) {
      stats.lastActiveAt = tx.createdAt;
    }

    stats.activeClientIds.add(tx.clientId);
    userStats.set(tx.cashierId, stats);
  }

  const teamMembers: TeamMember[] = users.map((user) => {
    const stats = userStats.get(user.id);
    const lastActive = stats?.lastActiveAt ?? user.updatedAt ?? user.createdAt;
    const daysSinceCreated = diffDays(user.createdAt, now);

    let status: TeamMemberStatus;
    if (!user.isActive) status = "En riesgo";
    else if (daysSinceCreated <= 14) status = "Nuevo ingreso";
    else status = "En curso";

    return {
      id: `tm-${user.id}`,
      name: user.name,
      email: user.email,
      role: mapUserRoleToLabel(user.role),
      status,
      activeDeals: stats?.activeClientIds.size ?? 0,
      lastActive: lastActive.toISOString().slice(0, 10),
    };
  });

  const clientAccounts: ClientAccount[] = clients.map((client) => {
    const stats = clientStats.get(client.id);
    const created = client.createdAt;
    const onboardingDays = diffDays(created, now);
    const lastInteraction = stats?.lastInteractionAt ?? created;
    const lastCharge = stats?.lastChargeAt;

    // Etapa inventada para el dashboard (no se guarda en DB)
    let stage: ClientLifecycleStage;
    if (onboardingDays <= 14) stage = "Incorporación";
    else if (onboardingDays <= 60) stage = "Nutrición";
    else stage = "Expansión";

    // Salud según recencia de la última carga (también sólo para la vista)
    let health: ClientHealthStatus;
    if (!lastCharge) {
      health = "En riesgo";
    } else {
      const daysSinceCharge = diffDays(lastCharge, now);
      if (daysSinceCharge <= 7) health = "Saludable";
      else if (daysSinceCharge <= 30) health = "Necesita atención";
      else health = "En riesgo";
    }

    const monthlyValue = stats?.totalChargedLast30 ?? 0;

    return {
      id: `cl-${client.id}`,
      // 👇 Estos son labels de UI. No son campos del schema.
      company: client.username,
      poc: client.username,
      email: "", // no existe email en el schema, así que lo dejamos vacío
      stage,
      monthlyValue,
      health,
      lastInteraction: lastInteraction.toISOString().slice(0, 10),
      onboardingDays,
      notes: undefined,
    };
  });

  return {
    teamMembers,
    clients: clientAccounts,
  };
}

// ---- Mutaciones ----

export async function addTeamMember(input: {
  name: string;
  email: string;
  roleLabel: string;
  status: TeamMemberStatus;
}): Promise<TeamMember> {
  const { name, email, roleLabel, status } = input;

  if (!name || !email || !roleLabel) {
    throw new Error("Nombre, correo y rol son obligatorios.");
  }

  const lower = roleLabel.toLowerCase();
  let systemRole: UserRole = "AGENT";

  if (lower.includes("admin") || lower.includes("director")) {
    systemRole = "ADMIN";
  } else if (lower.includes("cajero") || lower.includes("cashier")) {
    systemRole = "CASHIER";
  }

  const dbUser = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim(),
      role: systemRole,
      isActive: true,
    },
  });

  const now = new Date();

  const member: TeamMember = {
    id: `tm-${dbUser.id}`,
    name: dbUser.name,
    email: dbUser.email,
    role: roleLabel.trim() || mapUserRoleToLabel(dbUser.role),
    status,
    activeDeals: 0,
    lastActive: now.toISOString().slice(0, 10),
  };

  return member;
}

export async function addClientAccount(input: {
  company: string;
  poc: string;
  email: string;
  stage: ClientLifecycleStage;
  monthlyValue: number;
  onboardingDays: number;
  notes?: string;
}): Promise<ClientAccount> {
  const { company, poc, email, stage, monthlyValue, onboardingDays, notes } =
    input;

  if (!company || !poc || !email) {
    throw new Error(
      "Nombre de empresa, punto de contacto y correo son obligatorios en el formulario.",
    );
  }

  // 👇 A NIVEL DB: sólo persistimos username, nada más.
  const baseUsername = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const username = (baseUsername || "client") + "-" + Date.now();

  const dbClient = await prisma.client.create({
    data: {
      username,
      // NADA MÁS: ni phone, ni status, ni marketingSource, etc.
      // status usa el default (ACTIVE), pointsBalance default(0), etc.
    },
  });

  const now = new Date();

  // Salud para la vista (no se guarda)
  const health: ClientHealthStatus =
    stage === "Expansión"
      ? "Saludable"
      : stage === "Nutrición"
        ? "Necesita atención"
        : "Saludable";

  const clientAccount: ClientAccount = {
    id: `cl-${dbClient.id}`,
    // Estos son datos de UI, no campos de la tabla Client
    company: company.trim(),
    poc: poc.trim(),
    email: email.trim(),
    stage,
    monthlyValue: Number.isFinite(monthlyValue) ? monthlyValue : 0,
    health,
    lastInteraction: now.toISOString().slice(0, 10),
    onboardingDays: Number.isFinite(onboardingDays) ? onboardingDays : 14,
    notes: notes?.trim() || undefined,
  };

  return clientAccount;
}
