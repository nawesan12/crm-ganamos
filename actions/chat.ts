"use server";

import { prisma } from "@/lib/prisma";
import { MessageSenderType, MessageType } from "@prisma/client";
import { z } from "zod";

/* ----------------------------------------
 * SAVE CHAT MESSAGE
 * -------------------------------------- */

const saveChatMessageSchema = z.object({
  clientId: z.number().int().optional().nullable(),
  clientSocketId: z.string().optional().nullable(),
  guestUsername: z.string().optional().nullable(),
  guestPhone: z.string().optional().nullable(),
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

  // Check if guest was manually converted to client
  let finalClientId = data.clientId;
  let finalGuestUsername = data.guestUsername;
  let finalGuestPhone = data.guestPhone;

  // ONLY convert guest to client if guest already exists as a client
  // (i.e., they were manually converted by an operator)
  // DO NOT auto-create clients from guests
  if (!finalClientId && data.guestUsername) {
    // Check if this guest was manually converted to a client
    const existingClient = await prisma.client.findUnique({
      where: { username: data.guestUsername },
    });

    if (existingClient) {
      // Guest was manually converted - use client ID
      finalClientId = existingClient.id;
      // Clear guest fields since we have a proper client now
      finalGuestUsername = null;
      finalGuestPhone = null;
      console.log(`✅ Guest "${data.guestUsername}" was converted to client #${finalClientId}`);
    } else {
      // Guest has not been converted yet - keep as guest
      console.log(`💬 Saving message for guest "${data.guestUsername}"`);
    }
  }

  const message = await prisma.chatMessage.create({
    data: {
      clientId: finalClientId ?? null,
      clientSocketId: data.clientSocketId ?? null,
      guestUsername: finalGuestUsername ?? null,
      guestPhone: finalGuestPhone ?? null,
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
  clientId: z.number().int().optional().nullable(),
  guestUsername: z.string().optional().nullable(),
  clientSocketId: z.string().optional().nullable(),
  limit: z.number().int().optional().default(100),
  sessionId: z.string().optional().nullable(),
});

export type GetChatHistoryInput = z.infer<typeof getChatHistorySchema>;

export async function getChatHistoryAction(input: GetChatHistoryInput) {
  const data = getChatHistorySchema.parse(input);

  const whereClause: any = {};

  if (data.clientId) {
    whereClause.clientId = data.clientId;
  } else if (data.guestUsername) {
    whereClause.guestUsername = data.guestUsername;
  } else if (data.clientSocketId) {
    whereClause.clientSocketId = data.clientSocketId;
  }

  if (data.sessionId) {
    whereClause.sessionId = data.sessionId;
  }

  const messages = await prisma.chatMessage.findMany({
    where: whereClause,
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
  clientId: z.number().int().optional().nullable(),
  guestUsername: z.string().optional().nullable(),
  operatorId: z.number().int(),
});

export type MarkMessagesAsReadInput = z.infer<typeof markMessagesAsReadSchema>;

export async function markMessagesAsReadAction(input: MarkMessagesAsReadInput) {
  const data = markMessagesAsReadSchema.parse(input);

  const whereClause: any = {
    senderType: MessageSenderType.CLIENT,
    isRead: false,
  };

  if (data.clientId) {
    whereClause.clientId = data.clientId;
  } else if (data.guestUsername) {
    whereClause.guestUsername = data.guestUsername;
    whereClause.clientId = null;
  }

  const result = await prisma.chatMessage.updateMany({
    where: whereClause,
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
  clientId: z.number().int().optional().nullable(),
  guestUsername: z.string().optional().nullable(),
});

export type GetUnreadCountInput = z.infer<typeof getUnreadCountSchema>;

export async function getUnreadCountAction(input: GetUnreadCountInput) {
  const data = getUnreadCountSchema.parse(input);

  const whereClause: any = {
    senderType: MessageSenderType.CLIENT,
    isRead: false,
  };

  if (data.clientId) {
    whereClause.clientId = data.clientId;
  } else if (data.guestUsername) {
    whereClause.guestUsername = data.guestUsername;
    whereClause.clientId = null;
  }

  const count = await prisma.chatMessage.count({
    where: whereClause,
  });

  return count;
}

/* ----------------------------------------
 * SEARCH MESSAGES
 * -------------------------------------- */

const searchMessagesSchema = z.object({
  clientId: z.number().int().optional().nullable(),
  guestUsername: z.string().optional().nullable(),
  searchTerm: z.string().min(1),
  limit: z.number().int().optional().default(50),
});

export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;

export async function searchMessagesAction(input: SearchMessagesInput) {
  const data = searchMessagesSchema.parse(input);

  const whereClause: any = {
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
  };

  // Add client/guest filter if provided
  if (data.clientId) {
    whereClause.clientId = data.clientId;
  } else if (data.guestUsername) {
    whereClause.guestUsername = data.guestUsername;
    whereClause.clientId = null;
  }

  const messages = await prisma.chatMessage.findMany({
    where: whereClause,
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
  try {
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

    // Get unique guest usernames from messages without clientId
    // Wrap in try-catch in case guestUsername field doesn't exist in production DB
    let guestUsernames: Array<{ guestUsername: string | null; _max: { guestPhone: string | null } }> = [];

    try {
      // @ts-expect-error - Prisma groupBy type inference issue with TypeScript 5.x
      guestUsernames = await prisma.chatMessage.groupBy({
        by: ['guestUsername'],
        where: {
          clientId: null,
          guestUsername: {
            not: null,
          },
        },
        _max: {
          guestPhone: true,
        },
      });
    } catch (guestError: any) {
      // If guestUsername field doesn't exist in DB, skip guest loading
      console.error("⚠️  Could not load guest chats (field may not exist in DB):", guestError.message);
      // Continue without guests
    }

    // For each client, get their last message and unread count
    const clientChats = await Promise.all(
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
          isGuest: false,
        };
      })
    );

    // For each guest username, check if they haven't been converted to a client yet
    const guestChats = await Promise.all(
      guestUsernames.map(async (guest) => {
        if (!guest.guestUsername) return null;

        // Check if this guest was already converted to a client
        const convertedClient = clients.find(c => c.username === guest.guestUsername);
        if (convertedClient) {
          // Skip - this guest is now a proper client and already included above
          return null;
        }

        const lastMessage = await prisma.chatMessage.findFirst({
          where: { guestUsername: guest.guestUsername, clientId: null },
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
            guestUsername: guest.guestUsername,
            clientId: null,
            senderType: MessageSenderType.CLIENT,
            isRead: false,
          },
        });

        return {
          client: {
            id: 0, // Temporary ID for guests
            username: guest.guestUsername,
            phone: guest._max.guestPhone ?? null,
            status: 'ACTIVE' as const,
          },
          lastMessage,
          unreadCount,
          isGuest: true,
        };
      })
    );

    // Combine and filter out nulls
    const allChats = [...clientChats, ...guestChats.filter((chat): chat is NonNullable<typeof chat> => chat !== null)];

    // Sort by last message time
    return allChats.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt?.getTime() ?? 0;
      const bTime = b.lastMessage?.createdAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  } catch (error: any) {
    console.error("❌ Error in getRecentChatsAction:", error);
    console.error("Error details:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    // Return empty array instead of throwing to prevent complete failure
    return [];
  }
}
