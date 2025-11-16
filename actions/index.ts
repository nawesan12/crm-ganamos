"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { UserRole } from "@prisma/client";

const createUserSchema = z.object({
  name: z.string().min(3),
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean().default(true),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export async function createUserAction(input: CreateUserInput) {
  const data = createUserSchema.parse(input);
  const { password, ...rest } = data;
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      ...rest,
      passwordHash,
    },
  });
}

const updateUserSchema = createUserSchema.omit({ password: true }).extend({
  id: z.number().int(),
  password: z.string().min(6).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export async function updateUserAction(input: UpdateUserInput) {
  const data = updateUserSchema.parse(input);
  const { id, password, ...rest } = data;
  const passwordUpdate = password
    ? { passwordHash: await hashPassword(password) }
    : undefined;
  return prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...passwordUpdate,
    },
  });
}

export async function listUsersAction() {
  return prisma.user.findMany({
    orderBy: { name: "asc" },
  });
}

const listClientsSchema = z.object({
  query: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
});

export type ListClientsInput = z.infer<typeof listClientsSchema>;

export async function listClientsAction(input: ListClientsInput) {
  const data = listClientsSchema.parse(input);
  const where = {
    status: data.status,
    OR: data.query
      ? [
          { username: { contains: data.query, mode: "insensitive" } },
          { fullName: { contains: data.query, mode: "insensitive" } },
          { phone: { contains: data.query, mode: "insensitive" } },
        ]
      : undefined,
  };

  const [clients, total] = await prisma.$transaction([
    prisma.client.findMany({
      //@ts-expect-error bla
      where,
      orderBy: { username: "asc" },
      skip: (data.page - 1) * data.pageSize,
      take: data.pageSize,
    }), //@ts-expect-error bla
    prisma.client.count({ where }),
  ]);

  return { clients, total };
}

const listClientHistorySchema = z.object({
  clientId: z.number().int(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
});

export type ListClientHistoryInput = z.infer<typeof listClientHistorySchema>;

export async function listClientTransactionsAction(
  input: ListClientHistoryInput,
) {
  const data = listClientHistorySchema.parse(input);
  const where = { clientId: data.clientId };

  const [transactions, total] = await prisma.$transaction([
    prisma.pointTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (data.page - 1) * data.pageSize,
      take: data.pageSize,
    }),
    prisma.pointTransaction.count({ where }),
  ]);

  return { transactions, total };
}

export async function listClientContactsAction(input: ListClientHistoryInput) {
  const data = listClientHistorySchema.parse(input);
  const where = { clientId: data.clientId };

  const [contacts, total] = await prisma.$transaction([
    prisma.clientContact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (data.page - 1) * data.pageSize,
      take: data.pageSize,
    }),
    prisma.clientContact.count({ where }),
  ]);

  return { contacts, total };
}

const createMarketingSourceSchema = z.object({
  name: z.string().min(3),
  platform: z.string().optional(),
  campaign: z.string().optional(),
});

export type CreateMarketingSourceInput = z.infer<
  typeof createMarketingSourceSchema
>;

export async function createMarketingSourceAction(
  input: CreateMarketingSourceInput,
) {
  const data = createMarketingSourceSchema.parse(input);
  return prisma.marketingSource.create({ data });
}

const updateMarketingSourceSchema = createMarketingSourceSchema.extend({
  id: z.number().int(),
});

export type UpdateMarketingSourceInput = z.infer<
  typeof updateMarketingSourceSchema
>;

export async function updateMarketingSourceAction(
  input: UpdateMarketingSourceInput,
) {
  const data = updateMarketingSourceSchema.parse(input);
  return prisma.marketingSource.update({
    where: { id: data.id },
    data,
  });
}

export async function listMarketingSourcesAction() {
  return prisma.marketingSource.findMany({
    orderBy: { name: "asc" },
  });
}

const deleteMarketingSourceSchema = z.object({
  id: z.number().int(),
});

export type DeleteMarketingSourceInput = z.infer<
  typeof deleteMarketingSourceSchema
>;

export async function deleteMarketingSourceAction(
  input: DeleteMarketingSourceInput,
) {
  const data = deleteMarketingSourceSchema.parse(input);
  const [, deleted] = await prisma.$transaction([
    prisma.client.updateMany({
      where: { marketingSourceId: data.id },
      data: { marketingSourceId: null },
    }),
    prisma.marketingSource.delete({ where: { id: data.id } }),
  ]);

  return deleted;
}
