"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import { ArrowLeft, Search, X, Loader2, UserPlus, Download } from "lucide-react";
import { useNotification } from "@/lib/useNotification";
import { soundManager } from "@/lib/sound-notifications";
import { useNotificationSettings } from "@/stores/notification-settings-store";
import { logger } from "@/lib/logger";
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

  const user = useAuthStore((state) => state.user);
  const notification = useNotification();
  const { getEffectiveVolume } = useNotificationSettings();

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null); // 🆕 para imágenes

  const activeClientIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeClientIdRef.current = activeClientId;

    // Mark messages as read when switching to a chat
    if (activeClientId && user) {
      const chat = chats.find((c) => c.clientId === activeClientId);
      if (chat && chat.clientDbId && chat.unread > 0) {
        markMessagesAsReadAction({
          clientId: chat.clientDbId,
          operatorId: user.id,
        }).then(() => {
          // Update unread count in local state
          setChats((prev) =>
            prev.map((c) =>
              c.clientId === activeClientId ? { ...c, unread: 0 } : c
            )
          );
        }).catch((err) => {
          logger.error("Error marking messages as read:", err);
        });
      }
    }
  }, [activeClientId, user, chats]);

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

  // ---------------- DATABASE HELPER FUNCTIONS ----------------

  const loadRecentChats = async () => {
    try {
      setIsLoadingChats(true);
      const recentChats = await getRecentChatsAction();

      const chatsData: Chat[] = await Promise.all(
        recentChats.map(async ({ client, unreadCount, isGuest }) => {
          // Load full history for each client (or guest)
          let history;

          if (isGuest) {
            // For guests, use guestUsername to load history
            history = await getChatHistoryAction({
              guestUsername: client.username,
              limit: 100
            });
          } else {
            // For registered clients, use clientId
            history = await getChatHistoryAction({
              clientId: client.id,
              limit: 100
            });
          }

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
        })
      );

      setChats(chatsData);
      logger.log(`✅ Loaded ${chatsData.length} chats from database`);
    } catch (err) {
      logger.error("Error loading recent chats:", err);
      notification.error("No se pudieron cargar los chats recientes");
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

    s.on("newChat", async (data: NewChatPayload) => {
      setChats((prev) => {
        const exists = prev.some((c) => c.clientId === data.clientId);
        if (exists) return prev;

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

      // Add message optimistically
      setChats((prev) =>
        prev.map((c) => {
          if (c.clientId !== data.from) return c;

          return {
            ...c,
            messages: [...c.messages, newMsg],
            unread:
              activeClientIdRef.current === data.from ? c.unread : c.unread + 1,
            isClientTyping: false,
          };
        })
      );

      // Save to database and update with ID
      const chat = chats.find((c) => c.clientId === data.from);
      if (chat) {
        const savedMessageId = await saveMessageToDb(chat.username, newMsg, chat.clientDbId);
        if (savedMessageId) {
          setChats((prev) =>
            prev.map((c) =>
              c.clientId === data.from
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.timestamp === newMsg.timestamp && !m.id
                        ? { ...m, id: savedMessageId }
                        : m
                    ),
                  }
                : c
            )
          );
        }
      }
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
    s.on("operatorMessageBroadcast", async (data: OperatorMessageBroadcast) => {
      // Don't add our own messages again (they're already added optimistically)
      if (data.operatorId === user?.id) return;

      setChats((prev) => {
        const updatedChats = prev.map((c) => {
          if (c.clientId !== data.clientId) return c;

          // Check if message already exists (by timestamp or id)
          const messageExists = c.messages.some(
            (m) =>
              m.timestamp === data.message.timestamp ||
              (m.id && data.message.id && m.id === data.message.id)
          );

          if (messageExists) return c;

          return {
            ...c,
            messages: [...c.messages, data.message],
          };
        });

        return updatedChats;
      });

      // Show notification if message is for a different chat
      if (activeClientIdRef.current !== data.clientId) {
        const chat = chats.find((c) => c.clientId === data.clientId);
        notification.info(
          `${data.operatorName} envió un mensaje a ${chat?.username || "un cliente"}`
        );
      }
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
    setChats((prev) =>
      prev.map((c) => (c.clientId === clientId ? { ...c, unread: 0 } : c)),
    );
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
    };

    socketRef.current.emit("operatorMessage", {
      to: activeChat.clientId,
      type: "text",
      message: input,
      operatorId: user.id,
      operatorName: user.name,
    });

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

    // Save to database and update with ID
    const savedMessageId = await saveMessageToDb(activeChat.username, newMsg, activeChat.clientDbId);
    if (savedMessageId) {
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
    }

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

      // Emitir al servidor
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

      // Save to database and update with ID
      const savedMessageId = await saveMessageToDb(activeChat.username, newMsg, activeChat.clientDbId);
      if (savedMessageId) {
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
      }

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
    <div className="flex h-screen bg-neutral-100 text-base text-neutral-800">
      {/* Sidebar - Hidden on mobile when chat is active */}
      <aside className={`w-full md:w-80 bg-white border-r border-neutral-200 flex flex-col overflow-y-auto ${activeClientId ? "hidden md:flex" : "flex"}`}>
        <div className="flex flex-col border-b border-neutral-200">
          <div className="flex items-center justify-between p-6 pb-3">
            <h2 className="font-semibold text-xl text-neutral-900">
              Chats activos
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className={`h-2 w-2 rounded-full ${statusDotClass} animate-pulse`} />
              <span>{statusLabel}</span>
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
                className="w-full pl-10 pr-10 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="px-6 pb-3 pt-2">
            <Link href="/crm">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-all">
                <ArrowLeft className="h-4 w-4" />
                Volver al CRM
              </button>
            </Link>
          </div>
        </div>

        {isLoadingChats ? (
          <p className="p-4 text-neutral-400 text-center text-sm">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Cargando chats...
          </p>
        ) : chats.length === 0 ? (
          <p className="p-4 text-neutral-400 text-center text-sm">
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
                    : "border-transparent text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className={`font-semibold truncate ${
                        isActive ? "text-white" : "text-neutral-900"
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
                    isActive ? "text-primary-foreground/90" : "text-neutral-500"
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
      <main className={`flex-1 flex flex-col bg-neutral-50 ${!activeClientId ? "hidden md:flex" : "flex"}`}>
        {activeChat ? (
          <>
            <header className="flex items-center justify-between p-4 md:p-6 bg-white border-b border-neutral-200 shadow-sm">
              <div className="flex items-center gap-3 flex-1">
                {/* Back button for mobile */}
                <button
                  onClick={() => setActiveClientId(null)}
                  className="md:hidden p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition-colors"
                  aria-label="Volver a la lista de chats"
                >
                  <ArrowLeft className="h-5 w-5 text-neutral-700" />
                </button>
                <div className="flex-1">
                  <div className="font-semibold text-neutral-900 text-base md:text-lg flex items-center gap-2">
                    Chat con {activeChat.username}
                    {!activeChat.clientDbId && (
                      <button
                        onClick={() => handleOpenCreateClientDialog(activeChat.username)}
                        className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                        title="Guardar como cliente"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    )}
                  {activeChat.isLoadingHistory && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                </div>
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  Cliente ID: {activeChat.clientId}
                  {activeChat.clientDbId && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">
                      DB: #{activeChat.clientDbId}
                    </span>
                  )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-neutral-500 text-right hidden md:block">
                <div>Total mensajes: {activeChat.messages.length}</div>
                {activeChat.unread > 0 && (
                  <div className="mt-1 text-red-500 font-medium">
                    {activeChat.unread} sin leer
                  </div>
                )}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-100">
              {activeChat.isLoadingHistory && activeChat.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm">Cargando historial del chat...</p>
                </div>
              )}

              {activeChat.messages.map((m, i) => {
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
                      <div className="text-xs text-neutral-500 mb-1 ml-2 font-medium">
                        {m.operatorName}
                      </div>
                    )}
                    <div
                      className={`p-4 rounded-2xl break-words text-sm ${
                        isOperator
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 rounded-br-lg"
                          : "bg-white text-neutral-800 shadow-sm border border-neutral-200 rounded-bl-lg"
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
                      {m.text && <div>{m.text}</div>}

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
                          {isOperator && m.id && (
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-label="Enviado y guardado"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                          {isOperator && !m.id && (
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
                <div className="mr-auto text-sm text-neutral-500 italic">
                  {activeChat.username} está escribiendo...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input + botones */}
            <form
              onSubmit={sendMessage}
              className="flex items-center gap-2 md:gap-3 border-t border-neutral-200 bg-white p-3 md:p-4"
            >
              {/* 🆕 Botón imagen */}
              <button
                type="button"
                onClick={handleImageButtonClick}
                className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-lg md:text-xl hover:bg-neutral-200 transition-all flex-shrink-0"
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

              <input
                className="flex-1 p-3 md:p-4 outline-none text-sm md:text-base text-neutral-800 bg-neutral-100 rounded-xl border border-neutral-200 transition-all focus:bg-white focus:ring-2 focus:ring-primary"
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
          <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 bg-neutral-50">
            <span
              className="text-7xl mb-4"
              role="img"
              aria-label="Chat bubbles"
            >
              💬
            </span>
            <p className="text-xl font-semibold mb-1 text-neutral-700">
              Seleccioná un chat para empezar
            </p>
            <p className="text-base text-neutral-500">
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
