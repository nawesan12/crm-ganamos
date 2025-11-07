// app/(dashboard)/cashier/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import {
  ClientStatus,
  PaymentMethod,
  TransactionType,
} from "@/generated/enums";

export type MembershipTier = "Premium" | "Estándar" | "Empresarial";

export type LedgerMember = {
  id: number;
  name: string; // viene de client.username
  membership: MembershipTier;
  coinsThisMonth: number;
  lastCharge?: string; // YYYY-MM-DD
  visitWindow?: string;
  preferences?: string;
};

export type ChargeLogEntry = {
  id: string;
  userId: number; // clientId
  userName: string; // client.username
  coins: number;
  timestamp: string;
  note?: string;
};

export type DailyChargeSheetRow = {
  clientId: number;
  username: string;
  phone: string | null;
  status: ClientStatus;
  hasCharged: boolean | null;
  checkedAt: string | null;
  checkedById: number | null;
  checkedByName: string | null;
};

export type DailyChargeCheckUpdate = {
  clientId: number;
  hasCharged: boolean;
  checkedAt: string;
  checkedById: number | null;
  checkedByName: string | null;
};

function getDayRange(dateStr: string) {
  const base = new Date(dateStr + "T00:00:00.000Z");
  const start = new Date(base);
  const end = new Date(base);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(dateStr: string) {
  const base = new Date(dateStr + "T00:00:00.000Z");
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

// Podés reemplazar esto con tu auth real (NextAuth, custom, etc.)
async function getCurrentUserIdOrNull(): Promise<number | null> {
  // EJEMPLO de cómo podría ser:
  // const session = await auth();
  // return session?.user?.id ?? null;

  return null; // placeholder
}

export async function getCashierDashboardData(selectedDate: string) {
  const { start: dayStart, end: dayEnd } = getDayRange(selectedDate);
  const { start: monthStart, end: monthEnd } = getMonthRange(selectedDate);

  // 1) Clientes activos (según enum ClientStatus en tu schema)
  const clients = await prisma.client.findMany({
    where: {
      status: "ACTIVE", // o ClientStatus.ACTIVE si lo importás
    },
  });

  // 2) Cargos del mes agrupados por cliente (para coinsThisMonth y lastCharge)
  const monthCharges = await prisma.pointTransaction.groupBy({
    by: ["clientId"],
    where: {
      type: TransactionType.CHARGE,
      createdAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    _sum: {
      amount: true,
    },
    _max: {
      createdAt: true,
    },
  });

  const monthChargesByClientId = new Map<
    number,
    {
      _sum: { amount: number | null };
      _max: { createdAt: Date | null };
    }
  >();

  monthCharges.forEach((row) => {
    monthChargesByClientId.set(row.clientId, {
      _sum: { amount: row._sum.amount },
      _max: { createdAt: row._max.createdAt },
    });
  });

  // 3) Cargos del día seleccionado (para el log)
  const dayCharges = await prisma.pointTransaction.findMany({
    where: {
      type: TransactionType.CHARGE,
      createdAt: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    include: {
      client: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const ledger: LedgerMember[] = clients.map((client) => {
    const agg = monthChargesByClientId.get(client.id);
    const coinsThisMonth = agg?._sum.amount ?? 0;
    const lastChargeIso = agg?._max.createdAt
      ? agg._max.createdAt.toISOString().slice(0, 10)
      : undefined;

    // “membership” sigue siendo sólo para UI hasta que lo agregues al schema
    const membership: MembershipTier = "Estándar";

    return {
      id: client.id,
      name: client.username, // 👈 único identificador real que tenés en el schema
      membership,
      coinsThisMonth,
      lastCharge: lastChargeIso,
      visitWindow: undefined,
      preferences: undefined,
    };
  });

  const chargeLog: ChargeLogEntry[] = dayCharges.map((tx) => ({
    id: tx.id.toString(),
    userId: tx.clientId,
    userName: tx.client.username, // 👈 nada de fullName
    coins: tx.amount,
    timestamp: tx.createdAt.toISOString(),
    note: tx.description ?? undefined,
  }));

  return {
    ledger,
    chargeLog,
  };
}

export async function getDailyChargeSheet(selectedDate: string) {
  const { start: dayStart } = getDayRange(selectedDate);

  const clients = await prisma.client.findMany({
    orderBy: { username: "asc" },
    include: {
      dailyChargeChecks: {
        where: { date: dayStart },
        include: { checkedBy: true },
        take: 1,
      },
    },
  });

  const rows: DailyChargeSheetRow[] = clients.map((client) => {
    const check = client.dailyChargeChecks[0];

    return {
      clientId: client.id,
      username: client.username,
      phone: client.phone ?? null,
      status: client.status,
      hasCharged: check?.hasCharged ?? null,
      checkedAt: check?.checkedAt ? check.checkedAt.toISOString() : null,
      checkedById: check?.checkedById ?? null,
      checkedByName: check?.checkedBy?.name ?? null,
    };
  });

  return rows;
}

export async function updateDailyChargeCheck(params: {
  clientId: number;
  hasCharged: boolean;
  selectedDate: string;
}) {
  const { clientId, hasCharged, selectedDate } = params;

  const cashierId = await getCurrentUserIdOrNull();
  const { start: dayStart } = getDayRange(selectedDate);

  const record = await prisma.dailyChargeCheck.upsert({
    where: {
      clientId_date: {
        clientId,
        date: dayStart,
      },
    },
    create: {
      clientId,
      date: dayStart,
      hasCharged,
      checkedById: cashierId,
    },
    update: {
      hasCharged,
      checkedAt: new Date(),
      checkedById: cashierId,
    },
    include: {
      checkedBy: true,
    },
  });

  return {
    clientId,
    hasCharged: record.hasCharged,
    checkedAt: record.checkedAt.toISOString(),
    checkedById: record.checkedById,
    checkedByName: record.checkedBy?.name ?? null,
  } satisfies DailyChargeCheckUpdate;
}

export async function registerCharge(params: {
  clientId: number;
  coins: number;
  selectedDate: string; // YYYY-MM-DD
  note?: string;
  method?: PaymentMethod | null;
}) {
  const { clientId, coins, selectedDate, note, method } = params;

  if (!Number.isFinite(coins) || coins <= 0) {
    throw new Error("El monto de monedas debe ser un número positivo.");
  }

  const cashierId = await getCurrentUserIdOrNull();

  const { start: dayStart } = getDayRange(selectedDate);
  // guardamos la fecha del DailyChargeCheck como medianoche de ese día
  const dailyDate = dayStart;

  const result = await prisma.$transaction(async (tx) => {
    // 1) Actualizar balance de puntos del cliente
    const client = await tx.client.update({
      where: { id: clientId },
      data: {
        pointsBalance: {
          increment: coins,
        },
      },
    });

    // 2) Crear PointTransaction
    const transaction = await tx.pointTransaction.create({
      data: {
        clientId,
        amount: coins,
        type: TransactionType.CHARGE,
        method: method ?? null,
        description: note ?? null,
        cashierId,
      },
      include: {
        client: true,
      },
    });

    // 3) Upsert del DailyChargeCheck
    await tx.dailyChargeCheck.upsert({
      where: {
        clientId_date: {
          clientId,
          date: dailyDate,
        },
      },
      create: {
        clientId,
        date: dailyDate,
        hasCharged: true,
        checkedById: cashierId,
      },
      update: {
        hasCharged: true,
        checkedAt: new Date(),
        checkedById: cashierId,
      },
    });

    return { client, transaction };
  });

  const newChargeLogEntry: ChargeLogEntry = {
    id: result.transaction.id.toString(),
    userId: result.transaction.clientId,
    userName: result.transaction.client.username, // 👈 de nuevo, sólo username
    coins,
    timestamp: result.transaction.createdAt.toISOString(),
    note: result.transaction.description ?? undefined,
  };

  return {
    clientId,
    newBalance: result.client.pointsBalance,
    newChargeLogEntry,
    lastChargeDate: selectedDate,
  };
}
