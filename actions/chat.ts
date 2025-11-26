"use server";

import { prisma } from "@/lib/prisma";
import { MessageSenderType, MessageType } from "@prisma/client";
import { z } from "zod";

/* ----------------------------------------
 * SAVE CHAT MESSAGE
 * -------------------------------------- */

const saveChatMessageSchema = z.object({
  clientId: z.number().int(),
  clientSocketId: z.string().optional().nullable(),
  senderType: z.nativeEnum(MessageSenderType),
  operatorId: z.number().int().optional().nullable(),
  messageType: z.nativeEnum(MessageType),
  text: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  imageName: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
});

export type SaveChatMessageInput = z.infer<typeof saveChatMessageSchema>;

export async function saveChatMessageAction(input: SaveChatMessageInput) {
  const data = saveChatMessageSchema.parse(input);

  const message = await prisma.chatMessage.create({
    data: {
      clientId: data.clientId,
      clientSocketId: data.clientSocketId ?? null,
      senderType: data.senderType,
      operatorId: data.operatorId ?? null,
      messageType: data.messageType,
      text: data.text ?? null,
      imageUrl: data.imageUrl ?? null,
      imageName: data.imageName ?? null,
      mimeType: data.mimeType ?? null,
      sessionId: data.sessionId ?? null,
    },
  });

  return message;
}

/* ----------------------------------------
 * GET CHAT HISTORY FOR A CLIENT
 * -------------------------------------- */

const getChatHistorySchema = z.object({
  clientId: z.number().int(),
  limit: z.number().int().optional().default(100),
  sessionId: z.string().optional().nullable(),
});

export type GetChatHistoryInput = z.infer<typeof getChatHistorySchema>;

export async function getChatHistoryAction(input: GetChatHistoryInput) {
  const data = getChatHistorySchema.parse(input);

  const messages = await prisma.chatMessage.findMany({
    where: {
      clientId: data.clientId,
      ...(data.sessionId ? { sessionId: data.sessionId } : {}),
    },
    orderBy: {
      createdAt: "asc",
    },
    take: data.limit,
    include: {
      operator: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
      client: {
        select: {
          id: true,
          username: true,
          phone: true,
        },
      },
    },
  });

  return messages;
}

/* ----------------------------------------
 * GET CLIENT BY USERNAME
 * -------------------------------------- */

const getClientByUsernameSchema = z.object({
  username: z.string().min(1),
});

export type GetClientByUsernameInput = z.infer<typeof getClientByUsernameSchema>;

export async function getClientByUsernameAction(input: GetClientByUsernameInput) {
  const data = getClientByUsernameSchema.parse(input);

  const client = await prisma.client.findUnique({
    where: {
      username: data.username,
    },
    select: {
      id: true,
      username: true,
      phone: true,
      status: true,
      pointsBalance: true,
      createdAt: true,
    },
  });

  return client;
}

/* ----------------------------------------
 * MARK MESSAGES AS READ
 * -------------------------------------- */

const markMessagesAsReadSchema = z.object({
  clientId: z.number().int(),
  operatorId: z.number().int(),
});

export type MarkMessagesAsReadInput = z.infer<typeof markMessagesAsReadSchema>;

export async function markMessagesAsReadAction(input: MarkMessagesAsReadInput) {
  const data = markMessagesAsReadSchema.parse(input);

  const result = await prisma.chatMessage.updateMany({
    where: {
      clientId: data.clientId,
      senderType: MessageSenderType.CLIENT,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result;
}

/* ----------------------------------------
 * GET UNREAD MESSAGE COUNT
 * -------------------------------------- */

const getUnreadCountSchema = z.object({
  clientId: z.number().int(),
});

export type GetUnreadCountInput = z.infer<typeof getUnreadCountSchema>;

export async function getUnreadCountAction(input: GetUnreadCountInput) {
  const data = getUnreadCountSchema.parse(input);

  const count = await prisma.chatMessage.count({
    where: {
      clientId: data.clientId,
      senderType: MessageSenderType.CLIENT,
      isRead: false,
    },
  });

  return count;
}

/* ----------------------------------------
 * SEARCH MESSAGES
 * -------------------------------------- */

const searchMessagesSchema = z.object({
  clientId: z.number().int().optional(),
  searchTerm: z.string().min(1),
  limit: z.number().int().optional().default(50),
});

export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;

export async function searchMessagesAction(input: SearchMessagesInput) {
  const data = searchMessagesSchema.parse(input);

  const messages = await prisma.chatMessage.findMany({
    where: {
      ...(data.clientId ? { clientId: data.clientId } : {}),
      OR: [
        {
          text: {
            contains: data.searchTerm,
            mode: "insensitive",
          },
        },
        {
          imageName: {
            contains: data.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: data.limit,
    include: {
      operator: {
        select: {
          id: true,
          name: true,
        },
      },
      client: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  return messages;
}

/* ----------------------------------------
 * GET RECENT CHATS WITH LAST MESSAGE
 * -------------------------------------- */

export async function getRecentChatsAction() {
  // Get all clients who have chat messages
  const clients = await prisma.client.findMany({
    where: {
      chatMessages: {
        some: {},
      },
    },
    select: {
      id: true,
      username: true,
      phone: true,
      status: true,
    },
  });

  // For each client, get their last message and unread count
  const chatsWithLastMessage = await Promise.all(
    clients.map(async (client) => {
      const lastMessage = await prisma.chatMessage.findFirst({
        where: { clientId: client.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          text: true,
          imageUrl: true,
          messageType: true,
          senderType: true,
          createdAt: true,
        },
      });

      const unreadCount = await prisma.chatMessage.count({
        where: {
          clientId: client.id,
          senderType: MessageSenderType.CLIENT,
          isRead: false,
        },
      });

      return {
        client,
        lastMessage,
        unreadCount,
      };
    })
  );

  // Sort by last message time
  return chatsWithLastMessage.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt?.getTime() ?? 0;
    const bTime = b.lastMessage?.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}
