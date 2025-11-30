"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import { ArrowLeft, Search, X, Loader2, UserPlus, Download, Sun, Moon, Zap, Smile } from "lucide-react";
import { useTheme } from "next-themes";
import { useNotification } from "@/lib/useNotification";
import { soundManager } from "@/lib/sound-notifications";
import { useNotificationSettings } from "@/stores/notification-settings-store";
import { logger } from "@/lib/logger";
import { cannedResponses, getSuggestedResponses, type CannedResponse } from "@/lib/canned-responses";
import {
  saveChatMessageAction,
  getChatHistoryAction,
  getClientByUsernameAction,
  getRecentChatsAction,
  markMessagesAsReadAction,
} from "@/actions/chat";
import { createClientAction } from "@/actions/crm";
import { MessageSenderType, MessageType } from "@prisma/client";
import { useAuthStore } from "@/stores/auth-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------- TYPES ----------------

interface Message {
  from: "client" | "operator";
  text?: string;
  image?: string; // 🆕 base64 / data URL
  mimeType?: string; // 🆕 opcional
  name?: string; // 🆕 nombre de archivo
  timestamp?: string;
  id?: number; // Database ID
  isRead?: boolean;
  operatorId?: number; // ID of operator who sent the message
  operatorName?: string; // Name of operator who sent the message
  messageId?: string; // Socket message ID for delivery tracking
  deliveryStatus?: "sent" | "delivered" | "read"; // Delivery status
}

interface Chat {
  clientId: string;
  username: string;
  messages: Message[];
  unread: number;
  isClientTyping?: boolean;
  clientDbId?: number; // Database client ID
  isLoadingHistory?: boolean;
}

interface NewChatPayload {
  clientId: string;
  username: string;
}

interface IncomingMessagePayload {
  from: string; // clientId
  type: "text" | "image";
  message?: string;
  image?: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

interface TypingPayload {
  from: string; // clientId (del lado del operador)
  isTyping: boolean;
}

interface OperatorMessageBroadcast {
  clientId: string; // The client this message was sent to
  message: Message; // The message that was sent
  operatorId: number; // ID of the operator who sent it
  operatorName: string; // Name of the operator who sent it
}

// ---------------- COMPONENT ----------------

export default function OperatorChatPanel() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [currentSessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCreateClientDialogOpen, setIsCreateClientDialogOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({ username: "", phone: "" });
  const [clientToCreate, setClientToCreate] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [operatorStatus, setOperatorStatus] = useState<"online" | "away" | "busy" | "offline">("online");
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const [cannedSearchQuery, setCannedSearchQuery] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [suggestedResponses, setSuggestedResponses] = useState<CannedResponse[]>([]);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [showMessageSearch, setShowMessageSearch] = useState(false);

  const user = useAuthStore((state) => state.user);
  const notification = useNotification();
  const { getEffectiveVolume } = useNotificationSettings();
  const { theme, setTheme } = useTheme();

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null); // 🆕 para imágenes

  const activeClientIdRef = useRef<string | null>(null);
  const userIdRef = useRef<number | undefined>(undefined);

  // Keep userIdRef in sync with current user
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user]);

  useEffect(() => {
    activeClientIdRef.current = activeClientId;

    // Mark messages as read when switching to a chat
    if (activeClientId && user) {
      logger.log(`🔵 Switched to chat: ${activeClientId}`);

      // Use functional update to get current chats without adding to dependencies
      setChats((prev) => {
        const chat = prev.find((c) => c.clientId === activeClientId);

        if (chat && chat.clientDbId && chat.unread > 0) {
          logger.log(`📖 Marking ${chat.unread} messages as read for ${chat.username}`);

          markMessagesAsReadAction({
            clientId: chat.clientDbId,
            operatorId: user.id,
          }).then(() => {
            logger.log(`✅ Successfully marked messages as read`);
            // Update unread count in local state
            setChats((prevChats) =>
              prevChats.map((c) =>
                c.clientId === activeClientId ? { ...c, unread: 0 } : c
              )
            );
          }).catch((err) => {
            logger.error("Error marking messages as read:", err);
          });
        }

        return prev; // Don't modify chats in this update
      });
    }
  }, [activeClientId, user]); // Remove 'chats' from dependencies!

  const operatorTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const operatorIsTypingRef = useRef<boolean>(false);

  const activeChat =
    activeClientId != null
      ? (chats.find((c) => c.clientId === activeClientId) ?? null)
      : null;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChat?.messages.length]);

  // ---------------- BROWSER NOTIFICATIONS & TAB TITLE ----------------
  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  // Update browser tab title with unread count
  useEffect(() => {
    const totalUnread = chats.reduce((sum, chat) => sum + chat.unread, 0);

    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Operator Chat`;
    } else {
      document.title = "Operator Chat";
    }

    return () => {
      document.title = "Operator Chat";
    };
  }, [chats]);

  // Show browser notification for new messages
  const showBrowserNotification = (title: string, body: string, icon?: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      // Only show if tab is not focused
      if (document.hidden) {
        const notif = new Notification(title, {
          body,
          icon: icon || "/favicon.ico",
          badge: "/favicon.ico",
          tag: "chat-message",
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notif.close(), 5000);
      }
    }
  };

  // ---------------- KEYBOARD SHORTCUTS ----------------
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + K: Open quick replies
      if (modifier && e.key === 'k') {
        e.preventDefault();
        setShowCannedResponses(prev => !prev);
        setShowEmojiPicker(false); // Close emoji picker
        notification.info("Respuestas rápidas " + (showCannedResponses ? "cerradas" : "abiertas"));
      }

      // Ctrl/Cmd + E: Open emoji picker
      if (modifier && e.key === 'e') {
        e.preventDefault();
        setShowEmojiPicker(prev => !prev);
        setShowCannedResponses(false); // Close canned responses
        notification.info("Selector de emojis " + (showEmojiPicker ? "cerrado" : "abierto"));
      }

      // Ctrl/Cmd + F: Open message search
      if (modifier && e.key === 'f' && activeClientId) {
        e.preventDefault();
        setShowMessageSearch(prev => !prev);
        if (!showMessageSearch) {
          // Focus search input after state update
          setTimeout(() => {
            const searchInput = document.getElementById('message-search-input') as HTMLInputElement;
            if (searchInput) searchInput.focus();
          }, 100);
        }
      }

      // Ctrl/Cmd + Enter: Send message (if input has focus)
      if (modifier && e.key === 'Enter') {
        e.preventDefault();
        const form = document.querySelector('form') as HTMLFormElement;
        if (form && input.trim()) {
          form.requestSubmit();
        }
      }

      // Ctrl/Cmd + 1-9: Switch to chat 1-9
      if (modifier && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (chats[index]) {
          handleSelectChat(chats[index].clientId);
          notification.info(`Cambiado a chat ${e.key}`);
        }
      }

      // Ctrl/Cmd + /: Show shortcuts help
      if (modifier && e.key === '/') {
        e.preventDefault();
        notification.info(
          "Atajos: Ctrl/Cmd+K (respuestas), Ctrl/Cmd+E (emojis), Ctrl/Cmd+F (buscar), Ctrl/Cmd+Enter (enviar), Ctrl/Cmd+1-9 (cambiar chat), Esc (cerrar menús)"
        );
      }

      // Esc: Close quick replies menu, emoji picker, and message search
      if (e.key === 'Escape') {
        setShowCannedResponses(false);
        setShowEmojiPicker(false);
        setShowMessageSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [chats, input, showCannedResponses, showEmojiPicker, showMessageSearch, activeClientId, notification]);

  // ---------------- DATABASE HELPER FUNCTIONS ----------------

  const loadRecentChats = async () => {
    try {
      setIsLoadingChats(true);
      logger.log("🔄 Loading recent chats...");

      const recentChats = await getRecentChatsAction();
      logger.log(`📥 Received ${recentChats.length} chats from server`);

      const chatsData: Chat[] = await Promise.all(
        recentChats.map(async ({ client, unreadCount, isGuest }, index) => {
          try {
            logger.log(`Loading chat ${index + 1}/${recentChats.length}: ${client.username} (guest: ${isGuest})`);

            // Load full history for each client (or guest)
            let history;

            if (isGuest) {
              // For guests, use guestUsername to load history
              logger.log(`  → Loading guest history for ${client.username}`);
              history = await getChatHistoryAction({
                guestUsername: client.username,
                limit: 100
              });
            } else {
              // For registered clients, use clientId
              logger.log(`  → Loading client history for ID ${client.id}`);
              history = await getChatHistoryAction({
                clientId: client.id,
                limit: 100
              });
            }

            logger.log(`  ✓ Loaded ${history.length} messages`);

            const messages: Message[] = history.map((msg: any) => ({
              from: msg.senderType === MessageSenderType.CLIENT ? "client" : "operator",
              text: msg.text ?? undefined,
              image: msg.imageUrl ?? undefined,
              mimeType: msg.mimeType ?? undefined,
              name: msg.imageName ?? undefined,
              timestamp: msg.createdAt.toISOString(),
              id: msg.id,
              isRead: msg.isRead,
              operatorId: msg.operatorId ?? undefined,
              operatorName: msg.operator?.name ?? undefined,
            }));

            return {
              clientId: `client_${client.id}`, // Create a consistent clientId
              username: client.username,
              messages,
              unread: unreadCount,
              isClientTyping: false,
              clientDbId: isGuest ? undefined : client.id,
              isLoadingHistory: false,
            };
          } catch (chatError) {
            logger.error(`  ✗ Error loading chat for ${client.username}:`, chatError);
            // Return minimal chat data even if history fails to load
            return {
              clientId: `client_${client.id}`,
              username: client.username,
              messages: [],
              unread: unreadCount,
              isClientTyping: false,
              clientDbId: isGuest ? undefined : client.id,
              isLoadingHistory: false,
            };
          }
        })
      );

      setChats(chatsData);
      logger.log(`✅ Successfully loaded ${chatsData.length} chats from database`);
    } catch (err: any) {
      logger.error("❌ Error loading recent chats:", err);
      logger.error("Error details:", {
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
      notification.error(`Error al cargar chats: ${err?.message || "Error desconocido"}`);
      // Set empty chats array instead of leaving it undefined
      setChats([]);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const loadChatHistory = async (clientUsername: string, clientDbId: number) => {
    try {
      const history = await getChatHistoryAction({ clientId: clientDbId, limit: 100 });

      const convertedMessages: Message[] = history.map((msg: any) => ({
        from: msg.senderType === MessageSenderType.CLIENT ? "client" : "operator",
        text: msg.text ?? undefined,
        image: msg.imageUrl ?? undefined,
        mimeType: msg.mimeType ?? undefined,
        name: msg.imageName ?? undefined,
        timestamp: msg.createdAt.toISOString(),
        id: msg.id,
        isRead: msg.isRead,
        operatorId: msg.operatorId ?? undefined,
        operatorName: msg.operator?.name ?? undefined,
      }));

      setChats((prev) =>
        prev.map((c) =>
          c.username === clientUsername
            ? { ...c, messages: convertedMessages, isLoadingHistory: false }
            : c
        )
      );
    } catch (err) {
      logger.error("Error loading chat history:", err);
      notification.error("No se pudo cargar el historial del chat");
      setChats((prev) =>
        prev.map((c) =>
          c.username === clientUsername
            ? { ...c, isLoadingHistory: false }
            : c
        )
      );
    }
  };

  const saveMessageToDb = async (
    clientUsername: string,
    message: Message,
    clientDbId?: number
  ): Promise<number | null> => {
    try {
      // Determine if we have a registered client or a guest
      let dbClientId = clientDbId;
      let isGuest = !dbClientId;

      // Try to get client from database if not provided
      if (!dbClientId) {
        const client = await getClientByUsernameAction({ username: clientUsername });
        if (client) {
          dbClientId = client.id;
          isGuest = false;
        }
      }

      const savedMessage = await saveChatMessageAction({
        clientId: dbClientId ?? null,
        guestUsername: isGuest ? clientUsername : null,
        clientSocketId: message.from === "client" ? activeClientId ?? null : null,
        senderType: message.from === "client" ? MessageSenderType.CLIENT : MessageSenderType.OPERATOR,
        operatorId: message.from === "operator" ? user?.id ?? null : null,
        messageType: message.image ? MessageType.IMAGE : MessageType.TEXT,
        text: message.text ?? null,
        imageUrl: message.image ?? null,
        imageName: message.name ?? null,
        mimeType: message.mimeType ?? null,
        sessionId: currentSessionId,
      });

      return savedMessage.id;
    } catch (err) {
      logger.error("Error saving message to database:", err);
      return null;
    }
  };

  // Load recent chats on mount
  useEffect(() => {
    if (user) {
      loadRecentChats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "https://chat-backend-cbla.onrender.com";
    const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || "/chat";

    const s = io(socketUrl, {
      path: socketPath,
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = s;
    setConnectionStatus("connecting");

    s.on("connect", () => {
      logger.log("✅ Conectado como operador");
      setConnectionStatus("connected");
      notification.success("Conectado al servidor de chat");
      s.emit("join", {
        role: "operator",
        name: user?.name || "Operador",
        operatorId: user?.id
      });
    });

    s.on("disconnect", () => {
      logger.log("🔌 Desconectado");
      setConnectionStatus("disconnected");
      notification.warning("Desconectado del servidor de chat");
    });

    s.on("connect_error", (err) => {
      logger.error("❌ Error de conexión:", err.message);
      setConnectionStatus("disconnected");
      notification.error("Error de conexión al servidor de chat");
    });

    s.on("reconnect_attempt", (attempt) => {
      logger.log(`♻️ Intentando reconectar, intento #${attempt}`);
      setConnectionStatus("connecting");
    });

    s.on("reconnect", (attempt) => {
      logger.log(`✅ Reconexión exitosa después de ${attempt} intentos`);
      setConnectionStatus("connected");
      notification.success("Reconectado al servidor de chat");
    });

    s.on("reconnect_failed", () => {
      logger.error("❌ Falló la reconexión");
      setConnectionStatus("disconnected");
      notification.error("No se pudo reconectar al servidor de chat");
    });

    s.on("newChat", async (data: NewChatPayload) => {
      logger.log("🆕 New chat event received:", {
        clientId: data.clientId,
        username: data.username,
      });

      setChats((prev) => {
        const exists = prev.some((c) => c.clientId === data.clientId);
        const existsByUsername = prev.some((c) => c.username === data.username);

        logger.log("Checking for duplicates:", {
          existsByClientId: exists,
          existsByUsername: existsByUsername,
          currentChats: prev.map(c => ({ clientId: c.clientId, username: c.username }))
        });

        // Prevent duplicate by checking BOTH clientId and username
        if (exists || existsByUsername) {
          logger.log("⏭️ Skipping duplicate chat");
          return prev;
        }

        const updated = [
          ...prev,
          { ...data, messages: [], unread: 0, isClientTyping: false, isLoadingHistory: true },
        ];

        if (!activeClientIdRef.current && updated.length > 0) {
          setActiveClientId(data.clientId);
        }

        return updated;
      });

      // Load chat history from database
      try {
        const client = await getClientByUsernameAction({ username: data.username });
        if (client) {
          setChats((prev) =>
            prev.map((c) =>
              c.clientId === data.clientId ? { ...c, clientDbId: client.id } : c
            )
          );
          await loadChatHistory(data.username, client.id);
        } else {
          // Client doesn't exist in database - show notification
          notification.info(`Nuevo cliente: ${data.username}. Hacé clic en el ícono de usuario para guardar.`);
          setChats((prev) =>
            prev.map((c) =>
              c.clientId === data.clientId ? { ...c, isLoadingHistory: false } : c
            )
          );
        }
      } catch (err) {
        logger.error("Error loading client data:", err);
        setChats((prev) =>
          prev.map((c) =>
            c.clientId === data.clientId ? { ...c, isLoadingHistory: false } : c
          )
        );
      }
    });

    // 🆕 Soporte texto + imagen del cliente
    s.on("incomingMessage", async (data: IncomingMessagePayload) => {
      logger.log("📨 Incoming message from client:", {
        from: data.from,
        type: data.type,
        hasMessage: !!data.message,
        hasImage: !!data.image
      });

      const base = {
        from: "client" as const,
        timestamp: new Date().toISOString(),
      };

      const newMsg: Message =
        data.type === "image" && data.image
          ? {
              ...base,
              image: data.image,
              mimeType: data.mimeType,
              name: data.name,
            }
          : {
              ...base,
              text: data.message ?? "",
            };

      // Play sound for incoming message
      const volume = getEffectiveVolume('info');
      if (volume > 0) {
        soundManager.playSound('info', volume);
      }

      // Find chat BEFORE state update to get current data
      const existingChat = chats.find((c) => c.clientId === data.from);

      // Show browser notification
      if (existingChat) {
        const messagePreview = data.type === "image"
          ? "📷 Imagen"
          : (data.message?.substring(0, 50) || "Nuevo mensaje");

        showBrowserNotification(
          `Nuevo mensaje de ${existingChat.username}`,
          messagePreview
        );
      }

      // Smart auto-response suggestions (only for text messages from active chat)
      if (data.type === "text" && data.message && activeClientIdRef.current === data.from) {
        const suggestions = getSuggestedResponses(data.message);
        if (suggestions.length > 0) {
          setSuggestedResponses(suggestions);
          logger.log("💡 Smart suggestions:", suggestions.map(s => s.label));
        }
      }

      if (!existingChat) {
        logger.warn("⚠️ Chat not found for incoming message:", {
          clientId: data.from,
          availableChats: chats.map(c => c.clientId)
        });
      }

      // Add message optimistically and save to DB
      setChats((prev) => {
        return prev.map((c) => {
          if (c.clientId !== data.from) return c;

          const isActiveChatNow = activeClientIdRef.current === data.from;

          // Save to database asynchronously (don't await here to avoid blocking UI)
          saveMessageToDb(c.username, newMsg, c.clientDbId).then(async (savedMessageId) => {
            if (savedMessageId) {
              // Update with database ID
              setChats((prevChats) =>
                prevChats.map((chat) =>
                  chat.clientId === data.from
                    ? {
                        ...chat,
                        messages: chat.messages.map((m) =>
                          m.timestamp === newMsg.timestamp && !m.id
                            ? { ...m, id: savedMessageId, isRead: isActiveChatNow }
                            : m
                        ),
                      }
                    : chat
                )
              );

              // If chat is active, mark as read in DB immediately
              if (isActiveChatNow && c.clientDbId && userIdRef.current) {
                try {
                  await markMessagesAsReadAction({
                    clientId: c.clientDbId,
                    operatorId: userIdRef.current,
                  });
                  logger.log(`✅ Marked incoming message as read (chat is active)`);
                } catch (err) {
                  logger.error("Error marking incoming message as read:", err);
                }
              }
            }
          }).catch((err) => {
            logger.error("Error saving incoming message:", err);
          });

          return {
            ...c,
            messages: [...c.messages, newMsg],
            unread: isActiveChatNow ? c.unread : c.unread + 1,
            isClientTyping: false,
          };
        });
      });
    });

    s.on("clientTyping", (data: TypingPayload) => {
      setChats((prev) =>
        prev.map((c) =>
          c.clientId === data.from
            ? { ...c, isClientTyping: data.isTyping }
            : c,
        ),
      );
    });

    s.on("chatEnded", ({ clientId }: { clientId: string }) => {
      setChats((prev) => prev.filter((c) => c.clientId !== clientId));
      if (activeClientIdRef.current === clientId) setActiveClientId(null);
    });

    // Listen for messages from other operators
    s.on("operatorBroadcast", async (data: any) => {
      logger.log("📡 Received operatorBroadcast event:", {
        clientId: data.clientId,
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        type: data.type,
        currentUserId: userIdRef.current,
        hasMessage: !!data.message,
        hasImage: !!data.image,
      });

      // Server sends: { clientId, operatorId, operatorName, type, message, image, timestamp }
      // Don't add our own messages again (they're already added optimistically)
      if (data.operatorId === userIdRef.current) {
        logger.log("⏭️  Skipping own message");
        return;
      }

      // Construct Message object from server data
      const newMsg: Message = data.type === "image"
        ? {
            from: "operator",
            image: data.image,
            name: data.name,
            mimeType: data.mimeType,
            timestamp: data.timestamp,
            operatorId: data.operatorId,
            operatorName: data.operatorName,
          }
        : {
            from: "operator",
            text: data.message,
            timestamp: data.timestamp,
            operatorId: data.operatorId,
            operatorName: data.operatorName,
          };

      logger.log("✏️  Adding message from other operator:", newMsg);

      setChats((prev) => {
        const targetChat = prev.find((c) => c.clientId === data.clientId);

        if (!targetChat) {
          logger.warn("⚠️  Chat not found for operatorBroadcast:", {
            lookingFor: data.clientId,
            availableChats: prev.map(c => ({ id: c.clientId, username: c.username }))
          });
          return prev;
        }

        const updatedChats = prev.map((c) => {
          if (c.clientId !== data.clientId) return c;

          // Check if message already exists (by timestamp)
          const messageExists = c.messages.some(
            (m) => m.timestamp === newMsg.timestamp && m.operatorId === data.operatorId
          );

          if (messageExists) {
            logger.log("ℹ️  Message already exists, skipping");
            return c;
          }

          logger.log(`✅ Adding broadcast message to chat ${c.username}`);

          // Note: We DON'T save to DB here because the sender already saved it.
          // This prevents duplicate messages in the database.
          // The message will be loaded from DB when we refresh or load chat history.

          return {
            ...c,
            messages: [...c.messages, newMsg],
          };
        });

        return updatedChats;
      });

      // Show notification if message is for a different chat (use updated logic)
      if (activeClientIdRef.current !== data.clientId) {
        setChats((prev) => {
          const targetChat = prev.find((c) => c.clientId === data.clientId);
          if (targetChat) {
            notification.info(
              `${data.operatorName} envió un mensaje a ${targetChat.username}`
            );
          }
          return prev;
        });
      }
    });

    // Message sent confirmation from backend
    s.on("messageSent", (data: { messageId: string; clientId: string; timestamp: string; queued: boolean }) => {
      logger.log("📤 Message sent confirmation:", data);
      // Update the last message with the backend-generated messageId
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.clientId === data.clientId) {
            const lastMsg = chat.messages[chat.messages.length - 1];
            if (lastMsg && lastMsg.from === "operator" && !lastMsg.messageId) {
              return {
                ...chat,
                messages: chat.messages.map((msg, idx) =>
                  idx === chat.messages.length - 1
                    ? { ...msg, messageId: data.messageId, deliveryStatus: data.queued ? "sent" as const : "delivered" as const }
                    : msg
                ),
              };
            }
          }
          return chat;
        })
      );
    });

    // Message delivered confirmation
    s.on("messageDelivered", (data: { messageId: string; clientId: string; timestamp: string }) => {
      logger.log("✅ Message delivered:", data);
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.clientId === data.clientId) {
            return {
              ...chat,
              messages: chat.messages.map((msg) =>
                msg.messageId === data.messageId
                  ? { ...msg, deliveryStatus: "delivered" as const }
                  : msg
              ),
            };
          }
          return chat;
        })
      );
    });

    // Message read confirmation
    s.on("messageRead", (data: { messageId: string; clientId: string; timestamp: string }) => {
      logger.log("📖 Message read:", data);
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.clientId === data.clientId) {
            return {
              ...chat,
              messages: chat.messages.map((msg) =>
                msg.messageId === data.messageId
                  ? { ...msg, deliveryStatus: "read" as const }
                  : msg
              ),
            };
          }
          return chat;
        })
      );
    });

    // Message queued notification (client offline)
    s.on("messageQueued", (data: { messageId: string; clientId: string; reason: string }) => {
      logger.log("📤 Message queued:", data);
      notification.warning(`Mensaje en cola: ${data.reason}`);
    });

    // Operator status changed
    s.on("operatorStatusChanged", (data: { operatorId: number; operatorName: string; status: string }) => {
      logger.log("👤 Operator status changed:", data);
      notification.info(`${data.operatorName} está ${data.status}`);
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      if (operatorTypingTimeoutRef.current) {
        clearTimeout(operatorTypingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectChat = (clientId: string) => {
    setActiveClientId(clientId);
    setSuggestedResponses([]); // Clear suggestions when switching chats
    setMessageSearchQuery(""); // Clear message search when switching chats
    setShowMessageSearch(false); // Close message search when switching chats
    // Don't set unread to 0 here - let the useEffect handle it after DB update
    // This prevents phantom notifications if the DB update fails
  };

  const handleOpenCreateClientDialog = (username: string) => {
    setClientToCreate(username);
    setNewClientData({ username, phone: "" });
    setIsCreateClientDialogOpen(true);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newClientData.username.trim()) {
      notification.error("El nombre de usuario es requerido");
      return;
    }

    try {
      const client = await createClientAction({
        username: newClientData.username.trim(),
        phone: newClientData.phone.trim() || undefined,
      });

      // Update chat with database client ID
      setChats((prev) =>
        prev.map((c) =>
          c.username === newClientData.username
            ? { ...c, clientDbId: client.id }
            : c
        )
      );

      // Load history for the newly created client
      await loadChatHistory(client.username, client.id);

      notification.success(`Cliente ${client.username} guardado correctamente`);
      setIsCreateClientDialogOpen(false);
      setNewClientData({ username: "", phone: "" });
      setClientToCreate(null);
    } catch (err) {
      logger.error("Error creating client:", err);
      notification.error("No se pudo guardar el cliente. Verificá que el usuario sea único.");
    }
  };

  const handleDownloadImage = (imageUrl: string, imageName?: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = imageName || `image_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const changeOperatorStatus = (newStatus: "online" | "away" | "busy" | "offline") => {
    const socket = socketRef.current;
    if (!socket) return;

    setOperatorStatus(newStatus);
    socket.emit("operatorStatusChange", { status: newStatus });

    const statusText = {
      online: "disponible",
      away: "ausente",
      busy: "ocupado",
      offline: "desconectado"
    };
    notification.success(`Tu estado cambió a: ${statusText[newStatus]}`);
  };

  const notifyOperatorTyping = (isTyping: boolean) => {
    const socket = socketRef.current;
    const currentClientId = activeClientIdRef.current;
    if (!socket || !currentClientId) return;

    socket.emit("operatorTyping", {
      to: currentClientId,
      isTyping,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    const socket = socketRef.current;
    if (!socket || !activeClientIdRef.current) return;

    if (!operatorIsTypingRef.current) {
      operatorIsTypingRef.current = true;
      notifyOperatorTyping(true);
    }

    if (operatorTypingTimeoutRef.current) {
      clearTimeout(operatorTypingTimeoutRef.current);
    }

    operatorTypingTimeoutRef.current = setTimeout(() => {
      operatorIsTypingRef.current = false;
      notifyOperatorTyping(false);
    }, 1500);
  };

  // 🆕 Enviar mensaje de TEXTO
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChat || !socketRef.current || !user) return;

    const newMsg: Message = {
      from: "operator",
      text: input,
      timestamp: new Date().toISOString(),
      operatorId: user.id,
      operatorName: user.name,
      deliveryStatus: "sent",
    };

    // Add message optimistically (without ID)
    setChats((prev) =>
      prev.map((c) =>
        c.clientId === activeChat.clientId
          ? {
              ...c,
              messages: [...c.messages, newMsg],
            }
          : c,
      ),
    );

    // Save to database FIRST (before broadcasting) to prevent race condition
    logger.log(`💾 Saving message to DB for ${activeChat.username}`);
    const savedMessageId = await saveMessageToDb(activeChat.username, newMsg, activeChat.clientDbId);
    logger.log(`📝 Message saved with ID: ${savedMessageId}`);

    if (savedMessageId) {
      logger.log(`✅ Updating message with ID ${savedMessageId}`);
      setChats((prev) =>
        prev.map((c) =>
          c.clientId === activeChat.clientId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.timestamp === newMsg.timestamp && m.from === "operator" && !m.id
                    ? { ...m, id: savedMessageId }
                    : m
                ),
              }
            : c,
        ),
      );
    } else {
      logger.error(`❌ Failed to save message - no ID returned`);
    }

    // NOW broadcast to other operators (after DB save completes)
    socketRef.current.emit("operatorMessage", {
      to: activeChat.clientId,
      type: "text",
      message: input,
      operatorId: user.id,
      operatorName: user.name,
    });

    if (operatorTypingTimeoutRef.current) {
      clearTimeout(operatorTypingTimeoutRef.current);
    }
    operatorIsTypingRef.current = false;
    notifyOperatorTyping(false);

    setInput("");
  };

  // 🆕 Click en botón de adjuntar imagen
  const handleImageButtonClick = () => {
    if (!activeChat) return;
    fileInputRef.current?.click();
  };

  // 🆕 Cuando el operador elige una imagen
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Solo podés enviar imágenes.");
      e.target.value = "";
      return;
    }

    if (!socketRef.current || !activeChat) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;

      if (!user) return;

      const newMsg: Message = {
        from: "operator",
        image: base64,
        mimeType: file.type,
        name: file.name,
        timestamp: new Date().toISOString(),
        operatorId: user.id,
        operatorName: user.name,
      };

      // Add message optimistically (without ID)
      setChats((prev) =>
        prev.map((c) =>
          c.clientId === activeChat.clientId
            ? {
                ...c,
                messages: [...c.messages, newMsg],
              }
            : c,
        ),
      );

      // Save to database FIRST (before broadcasting) to prevent race condition
      logger.log(`💾 Saving image message to DB for ${activeChat.username}`);
      const savedMessageId = await saveMessageToDb(activeChat.username, newMsg, activeChat.clientDbId);
      logger.log(`📝 Image message saved with ID: ${savedMessageId}`);

      if (savedMessageId) {
        logger.log(`✅ Updating image message with ID ${savedMessageId}`);
        setChats((prev) =>
          prev.map((c) =>
            c.clientId === activeChat.clientId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.timestamp === newMsg.timestamp && m.from === "operator" && !m.id
                      ? { ...m, id: savedMessageId }
                      : m
                  ),
                }
              : c,
          ),
        );
      } else {
        logger.error(`❌ Failed to save image message - no ID returned`);
      }

      // NOW broadcast to other operators (after DB save completes)
      socketRef.current?.emit("operatorMessage", {
        to: activeChat.clientId,
        type: "image",
        image: base64,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        operatorId: user.id,
        operatorName: user.name,
      });

      e.target.value = "";
    };

    reader.readAsDataURL(file);
  };

  const statusLabel =
    connectionStatus === "connected"
      ? "Conectado"
      : connectionStatus === "connecting"
        ? "Conectando..."
        : "Desconectado";

  const statusDotClass =
    connectionStatus === "connected"
      ? "bg-green-500"
      : connectionStatus === "connecting"
        ? "bg-yellow-400"
        : "bg-red-500";

  // ---------------- RENDER ----------------

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-900 text-base text-neutral-800 dark:text-neutral-200">
      {/* Sidebar - Hidden on mobile when chat is active */}
      <aside className={`w-full md:w-80 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex flex-col overflow-y-auto ${activeClientId ? "hidden md:flex" : "flex"}`}>
        <div className="flex flex-col border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center justify-between p-6 pb-3">
            <h2 className="font-semibold text-xl text-neutral-900 dark:text-neutral-100">
              Chats activos
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                ) : (
                  <Moon className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                )}
              </button>
              <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                <span className={`h-2 w-2 rounded-full ${statusDotClass} animate-pulse`} />
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>
          <div className="px-6 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Tu estado:</span>
              <select
                value={operatorStatus}
                onChange={(e) => changeOperatorStatus(e.target.value as "online" | "away" | "busy" | "offline")}
                className="flex-1 text-xs px-2 py-1.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              >
                <option value="online">🟢 Disponible</option>
                <option value="away">🟡 Ausente</option>
                <option value="busy">🔴 Ocupado</option>
                <option value="offline">⚫ Desconectado</option>
              </select>
            </div>
          </div>
          <div className="px-6 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 text-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="px-6 pb-3 pt-2">
            <Link href="/crm">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary dark:text-primary-foreground bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 rounded-lg transition-all">
                <ArrowLeft className="h-4 w-4" />
                Volver al CRM
              </button>
            </Link>
          </div>
        </div>

        {isLoadingChats ? (
          <p className="p-4 text-neutral-400 dark:text-neutral-500 text-center text-sm">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Cargando chats...
          </p>
        ) : chats.length === 0 ? (
          <p className="p-4 text-neutral-400 dark:text-neutral-500 text-center text-sm">
            No hay chats activos
          </p>
        ) : null}

        <div className="flex-1 overflow-y-auto p-3">
          {chats
            .filter((c) =>
              searchQuery
                ? c.username.toLowerCase().includes(searchQuery.toLowerCase())
                : true
            )
            .sort((a, b) => {
              // Get the timestamp of the last message for each chat
              const aLastMessage = a.messages[a.messages.length - 1];
              const bLastMessage = b.messages[b.messages.length - 1];

              // If no messages, put new chats at the top
              if (!aLastMessage && !bLastMessage) return 0;
              if (!aLastMessage) return -1; // Put chat with no messages first
              if (!bLastMessage) return 1;  // Put chat with no messages first

              // Sort by timestamp descending (most recent first)
              const aTime = new Date(aLastMessage.timestamp || 0).getTime();
              const bTime = new Date(bLastMessage.timestamp || 0).getTime();
              return bTime - aTime;
            })
            .map((c) => {
              const isActive = activeClientId === c.clientId;
              const lastMessage =
                c.messages[c.messages.length - 1]?.text ||
                (c.messages[c.messages.length - 1]?.image
                  ? "📷 Imagen"
                  : c.isLoadingHistory
                    ? "Cargando historial..."
                    : "Nuevo chat");

              return (
              <button
                key={c.clientId}
                type="button"
                onClick={() => handleSelectChat(c.clientId)}
                className={`w-full text-left p-4 rounded-xl cursor-pointer transition-all mb-1.5 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "border-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`font-semibold truncate ${
                        isActive ? "text-white" : "text-neutral-900 dark:text-neutral-100"
                      }`}
                    >
                      {c.username}
                    </span>
                    {!c.clientDbId && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                        title="Cliente no guardado en CRM"
                      >
                        <UserPlus className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {c.unread > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white animate-pulse">
                        {c.unread}
                      </span>
                    )}
                    {c.isLoadingHistory && (
                      <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                    )}
                  </div>
                </div>
                <div
                  className={`text-sm truncate ${
                    isActive ? "text-primary-foreground/90" : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {lastMessage}
                </div>
                {c.isClientTyping && (
                  <div
                    className={`mt-1 text-xs font-medium italic ${
                      isActive ? "text-primary-foreground" : "text-primary"
                    }`}
                  >
                    Escribiendo...
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat Window - Hidden on mobile when no active chat */}
      <main className={`flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-900 ${!activeClientId ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
            <header className="flex items-center justify-between p-4 md:p-6 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
              <div className="flex items-center gap-3 flex-1">
                {/* Back button for mobile */}
                <button
                  onClick={() => setActiveClientId(null)}
                  className="md:hidden p-2 -ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                  aria-label="Volver a la lista de chats"
                >
                  <ArrowLeft className="h-5 w-5 text-neutral-700" />
                </button>
                <div className="flex-1">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-base md:text-lg flex items-center gap-2">
                    Chat con {activeChat.username}
                    {!activeChat.clientDbId && (
                      <button
                        onClick={() => handleOpenCreateClientDialog(activeChat.username)}
                        className="p-1.5 bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 text-primary dark:text-primary-foreground rounded-lg transition-colors"
                        title="Guardar como cliente"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    )}
                  {activeChat.isLoadingHistory && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                  Cliente ID: {activeChat.clientId}
                  {activeChat.clientDbId && (
                    <span className="px-2 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground rounded text-[10px] font-medium">
                      DB: #{activeChat.clientDbId}
                    </span>
                  )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Search button */}
                <button
                  onClick={() => setShowMessageSearch(!showMessageSearch)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                  title="Buscar mensajes (Ctrl+F)"
                >
                  <Search className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                </button>

                <div className="text-xs text-neutral-500 dark:text-neutral-400 text-right hidden md:block">
                  <div>Total mensajes: {activeChat.messages.length}</div>
                  {activeChat.unread > 0 && (
                    <div className="mt-1 text-red-500 font-medium">
                      {activeChat.unread} sin leer
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Message Search Bar */}
            {showMessageSearch && (
              <div className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 p-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      id="message-search-input"
                      type="text"
                      placeholder="Buscar en esta conversación..."
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 text-sm border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {messageSearchQuery && (
                      <button
                        onClick={() => setMessageSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {messageSearchQuery && (
                    <span className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                      {activeChat.messages.filter(m =>
                        m.text?.toLowerCase().includes(messageSearchQuery.toLowerCase())
                      ).length} resultados
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setShowMessageSearch(false);
                      setMessageSearchQuery("");
                    }}
                    className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                    title="Cerrar búsqueda"
                  >
                    <X className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-100 dark:bg-neutral-900">
              {activeChat.isLoadingHistory && activeChat.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm">Cargando historial del chat...</p>
                </div>
              )}

              {activeChat.messages
                .filter(m => {
                  // If search query is active, only show matching messages
                  if (messageSearchQuery.trim()) {
                    return m.text?.toLowerCase().includes(messageSearchQuery.toLowerCase());
                  }
                  return true;
                })
                .map((m, i) => {
                const isOperator = m.from === "operator";
                const isCurrentUser = m.operatorId === user?.id;

                return (
                  <div
                    key={i}
                    className={`max-w-[75%] ${
                      isOperator ? "ml-auto" : "mr-auto"
                    }`}
                  >
                    {/* Show operator name for messages from other operators */}
                    {isOperator && !isCurrentUser && m.operatorName && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 ml-2 font-medium">
                        {m.operatorName}
                      </div>
                    )}
                    <div
                      className={`p-4 rounded-2xl break-words text-sm ${
                        isOperator
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 rounded-br-lg"
                          : "bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm border border-neutral-200 dark:border-neutral-700 rounded-bl-lg"
                      }`}
                    >
                      {/* 🆕 Render imagen si existe */}
                      {m.image && (
                        <div className="mb-2">
                          <div className="relative group">
                            <img
                              src={m.image}
                              alt={m.name || "Imagen"}
                              className="rounded-lg max-h-64 w-auto cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setSelectedImage(m.image!)}
                            />
                            <button
                              onClick={() => handleDownloadImage(m.image!, m.name)}
                              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Descargar imagen"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                          {m.name && (
                            <div className="mt-1 text-[11px] opacity-80">
                              {m.name}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Texto si hay */}
                      {m.text && (
                        <div>
                          {messageSearchQuery.trim() ? (
                            // Highlight search term
                            m.text.split(new RegExp(`(${messageSearchQuery})`, 'gi')).map((part, idx) =>
                              part.toLowerCase() === messageSearchQuery.toLowerCase() ? (
                                <mark key={idx} className="bg-yellow-300 dark:bg-yellow-600 text-neutral-900 dark:text-neutral-100 px-0.5 rounded">
                                  {part}
                                </mark>
                              ) : (
                                <span key={idx}>{part}</span>
                              )
                            )
                          ) : (
                            m.text
                          )}
                        </div>
                      )}

                      {m.timestamp && (
                        <span
                          className={`flex items-center gap-1 justify-end text-[11px] mt-2 ${
                            isOperator ? "text-primary-foreground/90" : "text-neutral-400"
                          }`}
                        >
                          <span>
                            {new Date(m.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {/* Delivery status indicators */}
                          {isOperator && m.deliveryStatus === "read" && (
                            <span className="text-xs text-blue-400" title="Leído">✓✓</span>
                          )}
                          {isOperator && m.deliveryStatus === "delivered" && (
                            <span className="text-xs opacity-70" title="Entregado">✓✓</span>
                          )}
                          {isOperator && m.deliveryStatus === "sent" && m.id && (
                            <span className="text-xs opacity-60" title="Enviado">✓</span>
                          )}
                          {isOperator && !m.deliveryStatus && !m.id && (
                            <svg
                              className="h-3 w-3 opacity-50 animate-spin"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-label="Enviando..."
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {activeChat.isClientTyping && (
                <div className="mr-auto text-sm text-neutral-500 dark:text-neutral-400 italic">
                  {activeChat.username} está escribiendo...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Smart Suggestions Banner */}
            {suggestedResponses.length > 0 && (
              <div className="border-t border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    💡 Respuestas sugeridas:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSuggestedResponses([])}
                    className="ml-auto text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                    title="Cerrar sugerencias"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedResponses.map((response, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInput(response.message);
                        setSuggestedResponses([]);
                        notification.success(`Usando: ${response.label}`);
                      }}
                      className="px-3 py-2 bg-white dark:bg-neutral-800 border border-primary/30 dark:border-primary/50 rounded-lg text-sm hover:bg-primary/10 dark:hover:bg-primary/20 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                        {response.label}
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                        {response.message.substring(0, 60)}...
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input + botones */}
            <form
              onSubmit={sendMessage}
              className="flex items-center gap-2 md:gap-3 border-t border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 md:p-4"
            >
              {/* 🆕 Botón respuestas rápidas */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCannedResponses(!showCannedResponses)}
                  className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-all flex-shrink-0"
                  title="Respuestas rápidas"
                >
                  <Zap className="h-5 w-5 text-primary" />
                </button>

                {/* Canned Responses Menu */}
                {showCannedResponses && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 max-h-96 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
                      <input
                        type="text"
                        placeholder="Buscar respuestas..."
                        value={cannedSearchQuery}
                        onChange={(e) => setCannedSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="overflow-y-auto max-h-80">
                      {cannedResponses
                        .filter((r) =>
                          cannedSearchQuery
                            ? r.label.toLowerCase().includes(cannedSearchQuery.toLowerCase()) ||
                              r.command.toLowerCase().includes(cannedSearchQuery.toLowerCase())
                            : true
                        )
                        .map((response) => (
                          <button
                            key={response.command}
                            type="button"
                            onClick={() => {
                              setInput(response.message);
                              setShowCannedResponses(false);
                              setCannedSearchQuery("");
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-700 last:border-b-0 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {response.label}
                              </span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                                {response.command}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                              {response.message}
                            </p>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 🆕 Botón imagen */}
              <button
                type="button"
                onClick={handleImageButtonClick}
                className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 flex items-center justify-center text-lg md:text-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-all flex-shrink-0"
                title="Enviar imagen"
              >
                📎
              </button>

              {/* 🆕 Input file oculto */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />

              {/* 🆕 Botón emoji picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-neutral-100 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-all flex-shrink-0"
                  title="Emojis (Ctrl+E)"
                >
                  <Smile className="h-5 w-5 text-primary" />
                </button>

                {/* Emoji Picker Menu */}
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 max-h-96 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Seleccionar Emoji
                      </h3>
                    </div>
                    <div className="overflow-y-auto max-h-80 p-3">
                      {/* Categorías de emojis */}
                      {[
                        {
                          name: "😀 Emociones",
                          emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️"],
                        },
                        {
                          name: "👋 Gestos",
                          emojis: ["👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏"],
                        },
                        {
                          name: "❤️ Corazones",
                          emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
                        },
                        {
                          name: "🎉 Celebración",
                          emojis: ["🎉", "🎊", "🎁", "🎈", "🎂", "🎀", "🎆", "🎇", "✨", "🎄", "🎃", "🎗", "🥇", "🥈", "🥉", "🏆", "🏅", "🎖"],
                        },
                        {
                          name: "🔥 Popular",
                          emojis: ["🔥", "💯", "⭐", "🌟", "✨", "⚡", "💥", "💫", "💢", "💬", "💭", "🗯", "💤", "👀", "👁", "🧠", "🫀", "🫁"],
                        },
                        {
                          name: "💼 Trabajo",
                          emojis: ["💼", "📊", "📈", "📉", "💰", "💵", "💴", "💶", "💷", "💳", "💸", "🏦", "🏪", "🏬", "🏢", "🏛", "⏰", "⏱", "⏲", "📅", "📆", "🗓", "📋", "📌", "📍", "✅", "❌", "⚠️"],
                        },
                        {
                          name: "🍕 Comida",
                          emojis: ["🍕", "🍔", "🍟", "🌭", "🥪", "🌮", "🌯", "🥙", "🍿", "🧂", "🥚", "🍳", "🧇", "🥞", "🧈", "🍞", "🥐", "🥨", "🥯", "🧀", "🍗", "🍖", "🦴", "🌶", "🥓", "🍕", "🍝", "🥗", "🍲", "🍱", "🍛", "🍜", "🍣", "🍤", "🥟", "🦪", "🍦", "🍨", "🍧", "🍰", "🎂", "🧁", "🍮", "🍩", "🍪", "🍫", "🍬", "🍭", "🍯"],
                        },
                        {
                          name: "⚽ Deportes",
                          emojis: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "⛸", "🥌"],
                        },
                      ].map((category, idx) => (
                        <div key={idx} className="mb-4">
                          <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                            {category.name}
                          </div>
                          <div className="grid grid-cols-8 gap-1">
                            {category.emojis.map((emoji, emojiIdx) => (
                              <button
                                key={emojiIdx}
                                type="button"
                                onClick={() => {
                                  setInput(prev => prev + emoji);
                                  setShowEmojiPicker(false);
                                }}
                                className="text-2xl hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded p-1 transition-colors"
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <input
                className="flex-1 p-3 md:p-4 outline-none text-sm md:text-base text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-700 rounded-xl border border-neutral-200 dark:border-neutral-600 transition-all focus:bg-white dark:focus:bg-neutral-800 focus:ring-2 focus:ring-primary placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
                placeholder="Escribí tu mensaje..."
                value={input}
                onChange={handleInputChange}
              />
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded-xl h-10 w-10 md:h-14 md:w-14 flex items-center justify-center text-xl md:text-2xl font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                disabled={connectionStatus === "disconnected"}
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900">
            <span
              className="text-7xl mb-4"
              role="img"
              aria-label="Chat bubbles"
            >
              💬
            </span>
            <p className="text-xl font-semibold mb-1 text-neutral-700 dark:text-neutral-300">
              Seleccioná un chat para empezar
            </p>
            <p className="text-base text-neutral-500 dark:text-neutral-400">
              Los chats de clientes nuevos aparecerán en la lista.
            </p>
          </div>
        )}
      </main>

      {/* Image Preview Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <DialogHeader>
            <DialogTitle>Vista previa de imagen</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-neutral-100 rounded-lg p-4 overflow-auto">
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Vista previa"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setSelectedImage(null)}
            >
              Cerrar
            </Button>
            {selectedImage && (
              <Button
                onClick={() => {
                  handleDownloadImage(selectedImage);
                  setSelectedImage(null);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Client Dialog */}
      <Dialog open={isCreateClientDialogOpen} onOpenChange={setIsCreateClientDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar cliente en CRM</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateClient} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="new-client-username" className="text-sm font-medium">
                Usuario / Identificador *
              </label>
              <Input
                id="new-client-username"
                value={newClientData.username}
                onChange={(e) => setNewClientData((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Nombre de usuario"
                required
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="new-client-phone" className="text-sm font-medium">
                Teléfono (opcional)
              </label>
              <Input
                id="new-client-phone"
                value={newClientData.phone}
                onChange={(e) => setNewClientData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="5491130000000"
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateClientDialogOpen(false);
                  setNewClientData({ username: "", phone: "" });
                  setClientToCreate(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                <UserPlus className="h-4 w-4 mr-2" />
                Guardar Cliente
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
