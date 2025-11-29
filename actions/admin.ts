// app/(dashboard)/admin/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { TransactionType, UserRole } from "@prisma/client";

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
  username: string;
  role: string; // label amigable
  status: TeamMemberStatus;
  activeDeals: number;
  lastActive: string; // YYYY-MM-DD
};

export type CashierSummary = {
  id: string; // cash-<userId>
  name: string;
  username: string;
  totalChargedLast30: number;
  chargesLast30: number;
  clientsServedLast30: number;
  lastChargeAt?: string;
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

export type AdminDashboardMetrics = {
  totalMonthlyValue: number;
  previousMonthlyValue: number;
  onboardingCount: number;
  onboardingPipelineValue: number;
  newClientsLast30: number;
  newClientsPrev30: number;
  healthyCount: number;
  totalClients: number;
  avgOnboardingTime: number;
  fastestOnboardingTime: number | null;
  slowestOnboardingTime: number | null;
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

function validatePassword(password: string): { valid: boolean; error?: string } {
  const trimmed = password.trim();

  if (!trimmed) {
    return { valid: false, error: "La contraseña no puede estar vacía" };
  }

  if (trimmed.length < 6) {
    return { valid: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }

  return { valid: true };
}

function detectUserRoleFromLabel(roleLabel: string): UserRole {
  const lower = roleLabel.toLowerCase().trim();

  if (lower.includes("admin") || lower.includes("director") || lower.includes("administrador")) {
    return "ADMIN";
  } else if (lower.includes("cajero") || lower.includes("cashier")) {
    return "CASHIER";
  }

  return "AGENT";
}

async function checkUsernameAvailable(username: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { username: username.trim() },
    select: { id: true },
  });

  return !existing;
}

async function createUserInDB(input: {
  name: string;
  username: string;
  passwordHash: string;
  role: UserRole;
}): Promise<{
  id: number;
  name: string;
  username: string;
  role: UserRole;
  createdAt: Date;
}> {
  const dbUser = await prisma.user.create({
    data: {
      name: input.name.trim(),
      username: input.username.trim(),
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      createdAt: true,
    },
  });

  return dbUser;
}

// ---- Carga del dashboard ----

export async function getAdminDashboardData(): Promise<{
  teamMembers: TeamMember[];
  clients: ClientAccount[];
  cashiers: CashierSummary[];
  metrics: AdminDashboardMetrics;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);
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
    totalChargedPrev30: number;
    lastInteractionAt?: Date;
  };

  const clientStats = new Map<number, ClientStats>();

  for (const tx of recentCharges) {
    const stats = clientStats.get(tx.clientId) ?? {
      totalChargedLast30: 0,
      totalChargedPrev30: 0,
    };

    if (!stats.lastChargeAt || tx.createdAt > stats.lastChargeAt) {
      stats.lastChargeAt = tx.createdAt;
    }

    if (tx.createdAt >= thirtyDaysAgo) {
      stats.totalChargedLast30 += tx.amount;
    } else if (tx.createdAt >= sixtyDaysAgo) {
      stats.totalChargedPrev30 += tx.amount;
    }

    if (!stats.lastInteractionAt || tx.createdAt > stats.lastInteractionAt) {
      stats.lastInteractionAt = tx.createdAt;
    }

    clientStats.set(tx.clientId, stats);
  }

  for (const contact of recentContacts) {
    const stats = clientStats.get(contact.clientId) ?? {
      totalChargedLast30: 0,
      totalChargedPrev30: 0,
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
      username: user.username,
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

  type CashierStats = {
    lastCharge?: Date;
    totalChargedLast30: number;
    chargesLast30: number;
    clientsServed: Set<number>;
  };

  const cashierStats = new Map<number, CashierStats>();

  for (const tx of recentCharges) {
    if (!tx.cashierId) continue;

    const stats = cashierStats.get(tx.cashierId) ?? {
      totalChargedLast30: 0,
      chargesLast30: 0,
      clientsServed: new Set<number>(),
    };

    if (tx.createdAt >= thirtyDaysAgo) {
      stats.totalChargedLast30 += tx.amount;
      stats.chargesLast30 += 1;
      stats.clientsServed.add(tx.clientId);
    }

    if (!stats.lastCharge || tx.createdAt > stats.lastCharge) {
      stats.lastCharge = tx.createdAt;
    }

    cashierStats.set(tx.cashierId, stats);
  }

  const cashiers: CashierSummary[] = users
    .filter((user) => user.role === "CASHIER")
    .map((cashier) => {
      const stats = cashierStats.get(cashier.id);

      return {
        id: `cash-${cashier.id}`,
        name: cashier.name,
        username: cashier.username,
        totalChargedLast30: stats?.totalChargedLast30 ?? 0,
        chargesLast30: stats?.chargesLast30 ?? 0,
        clientsServedLast30: stats?.clientsServed.size ?? 0,
        lastChargeAt: stats?.lastCharge
          ? stats.lastCharge.toISOString().slice(0, 10)
          : undefined,
      };
    });

  let previousMonthlyValue = 0;
  for (const stats of clientStats.values()) {
    previousMonthlyValue += stats.totalChargedPrev30 ?? 0;
  }

  const onboardingClients = clientAccounts.filter(
    (client) => client.stage === "Incorporación",
  );
  const onboardingPipelineValue = onboardingClients.reduce(
    (acc, client) => acc + client.monthlyValue,
    0,
  );
  const totalMonthlyValue = clientAccounts.reduce(
    (acc, client) => acc + client.monthlyValue,
    0,
  );
  const totalClients = clientAccounts.length;
  const healthyCount = clientAccounts.filter(
    (client) => client.health === "Saludable",
  ).length;
  const avgOnboardingTime =
    totalClients > 0
      ? Math.round(
          clientAccounts.reduce(
            (acc, client) => acc + client.onboardingDays,
            0,
          ) / totalClients,
        )
      : 0;

  const onboardingDays = clientAccounts.map((client) => client.onboardingDays);
  const fastestOnboardingTime =
    onboardingDays.length > 0 ? Math.min(...onboardingDays) : null;
  const slowestOnboardingTime =
    onboardingDays.length > 0 ? Math.max(...onboardingDays) : null;

  const newClientsLast30 = clientAccounts.filter(
    (client) => client.onboardingDays <= 30,
  ).length;
  const newClientsPrev30 = clientAccounts.filter(
    (client) => client.onboardingDays > 30 && client.onboardingDays <= 60,
  ).length;

  const metrics: AdminDashboardMetrics = {
    totalMonthlyValue,
    previousMonthlyValue,
    onboardingCount: onboardingClients.length,
    onboardingPipelineValue,
    newClientsLast30,
    newClientsPrev30,
    healthyCount,
    totalClients,
    avgOnboardingTime,
    fastestOnboardingTime,
    slowestOnboardingTime,
  };

  return {
    teamMembers,
    clients: clientAccounts,
    cashiers,
    metrics,
  };
}

// ---- Mutaciones ----

export async function addTeamMember(input: {
  name: string;
  username: string;
  password: string;
  roleLabel: string;
  status: TeamMemberStatus;
}): Promise<TeamMember> {
  // Trim inputs first
  const name = input.name?.trim() || "";
  const username = input.username?.trim() || "";
  const password = input.password || "";
  const roleLabel = input.roleLabel?.trim() || "";
  const status = input.status;

  // Validate inputs
  if (!name || !username || !password || !roleLabel) {
    throw new Error("Nombre, usuario, contraseña y rol son obligatorios.");
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.error);
  }

  // Check if username already exists
  const isAvailable = await checkUsernameAvailable(username);
  if (!isAvailable) {
    throw new Error(`El nombre de usuario "${username}" ya está en uso.`);
  }

  // Detect role from label
  const systemRole = detectUserRoleFromLabel(roleLabel);

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user in database
  try {
    const dbUser = await createUserInDB({
      name,
      username,
      passwordHash,
      role: systemRole,
    });

    const now = new Date();

    const member: TeamMember = {
      id: `tm-${dbUser.id}`,
      name: dbUser.name,
      username: dbUser.username,
      role: roleLabel || mapUserRoleToLabel(dbUser.role),
      status,
      activeDeals: 0,
      lastActive: now.toISOString().slice(0, 10),
    };

    return member;
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === "P2002") {
      throw new Error(`El nombre de usuario "${username}" ya está en uso.`);
    }
    throw error;
  }
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

export async function addCashier(input: {
  name: string;
  username: string;
  password: string;
}): Promise<{ teamMember: TeamMember; cashier: CashierSummary }> {
  // Trim inputs first
  const name = input.name?.trim() || "";
  const username = input.username?.trim() || "";
  const password = input.password || "";

  // Validate inputs
  if (!name || !username || !password) {
    throw new Error("Nombre, usuario y contraseña son obligatorios.");
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.error);
  }

  // Check if username already exists
  const isAvailable = await checkUsernameAvailable(username);
  if (!isAvailable) {
    throw new Error(`El nombre de usuario "${username}" ya está en uso.`);
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user in database
  try {
    const dbUser = await createUserInDB({
      name,
      username,
      passwordHash,
      role: "CASHIER",
    });

    const now = new Date();

    const teamMember: TeamMember = {
      id: `tm-${dbUser.id}`,
      name: dbUser.name,
      username: dbUser.username,
      role: mapUserRoleToLabel(dbUser.role),
      status: "Nuevo ingreso",
      activeDeals: 0,
      lastActive: now.toISOString().slice(0, 10),
    };

    const cashier: CashierSummary = {
      id: `cash-${dbUser.id}`,
      name: dbUser.name,
      username: dbUser.username,
      totalChargedLast30: 0,
      chargesLast30: 0,
      clientsServedLast30: 0,
      lastChargeAt: undefined,
    };

    return { teamMember, cashier };
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === "P2002") {
      throw new Error(`El nombre de usuario "${username}" ya está en uso.`);
    }
    throw error;
  }
}
