"use server";

import { prisma } from "@/lib/prisma";
import {
  ContactChannel,
  ContactDirection,
  PaymentMethod,
  TransactionType,
  ClientStatus,
} from "@prisma/client";
import { z } from "zod";
/* ----------------------------------------
 * Helpers
 * -------------------------------------- */

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/* ----------------------------------------
 * 1) CREATE / UPDATE CLIENT
 * -------------------------------------- */

const createClientSchema = z.object({
  username: z.string().min(3),
  phone: z.string().min(5).optional().nullable(),
  fullName: z.string().optional().nullable(),
  marketingSourceId: z.number().int().optional().nullable(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export async function createClientAction(input: CreateClientInput) {
  const data = createClientSchema.parse(input);

  const client = await prisma.client.create({
    data: {
      username: data.username,
      phone: data.phone ?? null,
      marketingSourceId: data.marketingSourceId ?? null,
      status: ClientStatus.ACTIVE,
    },
  });

  // Optionally revalidate lists
  // await revalidatePath("/crm/clients");

  return client;
}

const updateClientSchema = createClientSchema.extend({
  id: z.number().int(),
  status: z.nativeEnum(ClientStatus).optional(),
});

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export async function updateClientAction(input: UpdateClientInput) {
  const data = updateClientSchema.parse(input);

  const client = await prisma.client.update({
    where: { id: data.id },
    data: {
      username: data.username,
      phone: data.phone ?? null,
      marketingSourceId: data.marketingSourceId ?? null,
      status: data.status,
    },
  });

  // await revalidatePath(`/crm/clients/${client.id}`);
  return client;
}

/* ----------------------------------------
 * 2) LOG CONTACT (ads, WhatsApp, etc.)
 * -------------------------------------- */

const logContactSchema = z.object({
  clientId: z.number().int(),
  channel: z.nativeEnum(ContactChannel),
  direction: z.nativeEnum(ContactDirection),
  viaAd: z.boolean().default(false),
  campaign: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  handledById: z.number().int().optional().nullable(), // internal user (agent/cashier)
});

export type LogContactInput = z.infer<typeof logContactSchema>;

export async function logContactAction(input: LogContactInput) {
  const data = logContactSchema.parse(input);

  const contact = await prisma.clientContact.create({
    data: {
      clientId: data.clientId,
      channel: data.channel,
      direction: data.direction,
      viaAd: data.viaAd,
      campaign: data.campaign ?? null,
      message: data.message ?? null,
      handledById: data.handledById ?? null,
    },
  });

  // await revalidatePath(`/crm/clients/${data.clientId}`);
  return contact;
}

/* ----------------------------------------
 * 3) REGISTER POINT CHARGE (1 punto = 1 peso)
 *    (and update client.pointsBalance)
 * -------------------------------------- */

const registerChargeSchema = z.object({
  clientId: z.number().int(),
  amount: z.number().int().positive(), // pesos/puntos
  method: z.nativeEnum(PaymentMethod).optional().nullable(),
  description: z.string().optional().nullable(),
  referenceCode: z.string().optional().nullable(), // ticket, trans id, etc.
  cashierId: z.number().int().optional().nullable(), // internal User
});

export type RegisterChargeInput = z.infer<typeof registerChargeSchema>;

export async function registerPointChargeAction(input: RegisterChargeInput) {
  const data = registerChargeSchema.parse(input);

  const [tx, client] = await prisma.$transaction([
    prisma.pointTransaction.create({
      data: {
        clientId: data.clientId,
        amount: data.amount,
        type: TransactionType.CHARGE,
        method: data.method ?? null,
        description: data.description ?? null,
        referenceCode: data.referenceCode ?? null,
        cashierId: data.cashierId ?? null,
      },
    }),
    prisma.client.update({
      where: { id: data.clientId },
      data: {
        pointsBalance: {
          increment: data.amount,
        },
      },
    }),
  ]);

  // await revalidatePath(`/crm/clients/${data.clientId}`);
  return { transaction: tx, client };
}

/* Optional: Redeem points if you end up needing it later */

const redeemPointsSchema = z.object({
  clientId: z.number().int(),
  amount: z.number().int().positive(),
  description: z.string().optional().nullable(),
  cashierId: z.number().int().optional().nullable(),
});

export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;

export async function redeemPointsAction(input: RedeemPointsInput) {
  const data = redeemPointsSchema.parse(input);

  const client = await prisma.client.findUnique({
    where: { id: data.clientId },
    select: { pointsBalance: true },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  if (client.pointsBalance < data.amount) {
    throw new Error("Insufficient points balance");
  }

  const [tx, updatedClient] = await prisma.$transaction([
    prisma.pointTransaction.create({
      data: {
        clientId: data.clientId,
        amount: -data.amount,
        type: TransactionType.REDEEM,
        description: data.description ?? null,
        cashierId: data.cashierId ?? null,
      },
    }),
    prisma.client.update({
      where: { id: data.clientId },
      data: {
        pointsBalance: {
          decrement: data.amount,
        },
      },
    }),
  ]);

  // await revalidatePath(`/crm/clients/${data.clientId}`);
  return { transaction: tx, client: updatedClient };
}

/* ----------------------------------------
 * 4) DAILY CHECKBOX: "DID THIS USER CHARGE TODAY?"
 * -------------------------------------- */

const dailyCheckSchema = z.object({
  clientId: z.number().int(),
  date: z.string().optional(), // "YYYY-MM-DD" from the UI; defaults to today
  hasCharged: z.boolean(),
  checkedById: z.number().int().optional().nullable(), // cashier
});

export type DailyCheckInput = z.infer<typeof dailyCheckSchema>;

export async function upsertDailyChargeCheckAction(input: DailyCheckInput) {
  const data = dailyCheckSchema.parse(input);

  const dateBase = data.date ? new Date(data.date) : new Date();
  const date = startOfDay(dateBase); // normalize to the start of that day

  const record = await prisma.dailyChargeCheck.upsert({
    where: {
      clientId_date: {
        clientId: data.clientId,
        date,
      },
    },
    update: {
      hasCharged: data.hasCharged,
      checkedAt: new Date(),
      checkedById: data.checkedById ?? null,
    },
    create: {
      clientId: data.clientId,
      date,
      hasCharged: data.hasCharged,
      checkedById: data.checkedById ?? null,
    },
  });

  // await revalidatePath(`/crm/daily/${data.date ?? "today"}`);
  return record;
}

/* ----------------------------------------
 * 5) METRICS / OVERVIEW PER CLIENT
 * -------------------------------------- */

const getClientOverviewSchema = z.object({
  clientId: z.number().int(),
});

export type GetClientOverviewInput = z.infer<typeof getClientOverviewSchema>;

export async function getClientOverviewAction(input: GetClientOverviewInput) {
  const data = getClientOverviewSchema.parse(input);

  const [client, totals, lastCharge, lastContact] = await prisma.$transaction([
    prisma.client.findUnique({
      where: { id: data.clientId },
      include: { marketingSource: true },
    }), //@ts-expect-error bla
    prisma.pointTransaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
      where: { clientId: data.clientId },
    }),
    prisma.pointTransaction.findFirst({
      where: { clientId: data.clientId, type: TransactionType.CHARGE },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientContact.findFirst({
      where: { clientId: data.clientId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!client) {
    throw new Error("Client not found");
  }

  const totalCharged = //@ts-expect-error bla
    totals.find((t) => t.type === TransactionType.CHARGE)?._sum.amount ?? 0;
  const totalRedeemed = //@ts-expect-error bla
    totals.find((t) => t.type === TransactionType.REDEEM)?._sum.amount ?? 0;

  return {
    client,
    metrics: {
      totalChargedPoints: totalCharged,
      totalRedeemedPoints: Math.abs(totalRedeemed),
      currentBalance: client.pointsBalance,
      lastChargeAt: lastCharge?.createdAt ?? null,
      lastContactAt: lastContact?.createdAt ?? null,
      lastContactChannel: lastContact?.channel ?? null,
      lastContactDirection: lastContact?.direction ?? null,
    },
  };
}

/* ----------------------------------------
 * 6) DAILY SHEET FOR CASHIERS
 *    (list clients + check state for a given day)
 * -------------------------------------- */

const dailySheetSchema = z.object({
  date: z.string().optional(), // "YYYY-MM-DD", defaults to today
  onlyActive: z.boolean().optional().default(true),
});

export type DailySheetInput = z.infer<typeof dailySheetSchema>;

export async function getDailyChargeSheetAction(input: DailySheetInput) {
  const data = dailySheetSchema.parse(input);

  const dateBase = data.date ? new Date(data.date) : new Date();
  const date = startOfDay(dateBase);

  const clients = await prisma.client.findMany({
    where: data.onlyActive ? { status: ClientStatus.ACTIVE } : undefined,
    orderBy: { username: "asc" },
    include: {
      dailyChargeChecks: {
        where: { date },
      },
    },
  });

  return clients.map((client) => {
    const check = client.dailyChargeChecks[0];

    return {
      clientId: client.id,
      username: client.username,
      phone: client.phone,
      status: client.status,
      hasCharged: check?.hasCharged ?? null, // null: not checked yet
      checkedAt: check?.checkedAt ?? null,
      checkedById: check?.checkedById ?? null,
    };
  });
}
