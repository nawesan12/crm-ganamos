"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

// ---------------- TYPES ----------------

const QUICK_REPLIES = [
  "Hola 👋 ¿En qué puedo ayudarte hoy?",
  "Ya reviso tu caso y te respondo al instante.",
  "¿Podés enviarme una foto o detalle adicional?",
  "Gracias por escribirnos, ¡seguimos en contacto!",
];

interface Message {
  from: "client" | "operator";
  text?: string;
  image?: string; // 🆕 base64 / data URL
  mimeType?: string; // 🆕 opcional
  name?: string; // 🆕 nombre de archivo
  timestamp?: string;
}

interface Chat {
  clientId: string;
  username: string;
  messages: Message[];
  unread: number;
  isClientTyping?: boolean;
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

interface CreateClientApiResponse {
  success: boolean;
  client?: {
    id: number;
    username: string;
    phone: string | null;
  };
  error?: string;
}

// ---------------- COMPONENT ----------------

const renderMessageText = (text: string): ReactNode => {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const url = match[0];
    nodes.push(
      <a
        key={`link-${match.index}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline underline-offset-2 break-all"
      >
        {url}
      </a>,
    );

    lastIndex = match.index + url.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

export default function OperatorChatPanel() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [chatFilter, setChatFilter] = useState<"all" | "unread" | "typing">(
    "all",
  );
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [newClientUsername, setNewClientUsername] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [clientCreationError, setClientCreationError] = useState<string | null>(
    null,
  );
  const [clientCreationSuccess, setClientCreationSuccess] = useState<
    string | null
  >(null);
  const [chatNotes, setChatNotes] = useState<Record<string, string>>({});

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null); // 🆕 para imágenes

  const activeClientIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeClientIdRef.current = activeClientId;
  }, [activeClientId]);

  const operatorTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const operatorIsTypingRef = useRef<boolean>(false);

  const activeChat =
    activeClientId != null
      ? (chats.find((c) => c.clientId === activeClientId) ?? null)
      : null;
  const totalUnread = useMemo(
    () => chats.reduce((total, chat) => total + chat.unread, 0),
    [chats],
  );
  const typingChats = useMemo(
    () => chats.filter((chat) => chat.isClientTyping).length,
    [chats],
  );
  const filteredChats = useMemo(() => {
    const normalized = chatSearch.trim().toLowerCase();
    return chats.filter((chat) => {
      if (chatFilter === "unread" && chat.unread === 0) {
        return false;
      }
      if (chatFilter === "typing" && !chat.isClientTyping) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return (
        chat.username.toLowerCase().includes(normalized) ||
        chat.clientId.toLowerCase().includes(normalized)
      );
    });
  }, [chatFilter, chatSearch, chats]);

  const activeChatNotes = activeChat ? chatNotes[activeChat.clientId] ?? "" : "";
  const lastMessage = activeChat?.messages[activeChat.messages.length - 1];
  const lastMessageTimeLabel = lastMessage?.timestamp
    ? new Date(lastMessage.timestamp).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "Sin mensajes";
  const totalImagesInChat = activeChat
    ? activeChat.messages.filter((message) => Boolean(message.image)).length
    : 0;

  useEffect(() => {
    if (!clientCreationSuccess) return;
    const timer = setTimeout(() => setClientCreationSuccess(null), 5000);
    return () => clearTimeout(timer);
  }, [clientCreationSuccess]);

  useEffect(() => {
    setClientCreationError(null);
    setClientCreationSuccess(null);
  }, [activeClientId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChat?.messages.length]);

  useEffect(() => {
    const s = io("https://chat-backend-cbla.onrender.com", {
      path: "/chat",
      transports: ["websocket"],
    });

    socketRef.current = s;
    setConnectionStatus("connecting");

    s.on("connect", () => {
      console.log("✅ Conectado como operador");
      setConnectionStatus("connected");
      s.emit("join", { role: "operator", name: "Operador 1" });
    });

    s.on("disconnect", () => {
      console.log("🔌 Desconectado");
      setConnectionStatus("disconnected");
    });

    s.on("connect_error", (err) => {
      console.error("❌ Error de conexión:", err.message);
      setConnectionStatus("disconnected");
    });

    s.on("newChat", (data: NewChatPayload) => {
      setChats((prev) => {
        const exists = prev.some((c) => c.clientId === data.clientId);
        if (exists) return prev;

        const updated = [
          ...prev,
          { ...data, messages: [], unread: 0, isClientTyping: false },
        ];

        if (!activeClientIdRef.current && updated.length > 0) {
          setActiveClientId(data.clientId);
        }

        return updated;
      });
    });

    // 🆕 Soporte texto + imagen del cliente
    s.on("incomingMessage", (data: IncomingMessagePayload) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.clientId !== data.from) return c;

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

          return {
            ...c,
            messages: [...c.messages, newMsg],
            unread:
              activeClientIdRef.current === data.from ? c.unread : c.unread + 1,
            isClientTyping: false,
          };
        }),
      );
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

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      if (operatorTypingTimeoutRef.current) {
        clearTimeout(operatorTypingTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectChat = (clientId: string) => {
    setActiveClientId(clientId);
    setChats((prev) =>
      prev.map((c) => (c.clientId === clientId ? { ...c, unread: 0 } : c)),
    );
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

  const updateTypingActivity = () => {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    updateTypingActivity();
  };

  // 🆕 Enviar mensaje de TEXTO
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChat || !socketRef.current) return;

    socketRef.current.emit("operatorMessage", {
      to: activeChat.clientId,
      type: "text",
      message: input,
    });

    setChats((prev) =>
      prev.map((c) =>
        c.clientId === activeChat.clientId
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  from: "operator",
                  text: input,
                  timestamp: new Date().toISOString(),
                },
              ],
            }
          : c,
      ),
    );

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
    reader.onload = () => {
      const base64 = reader.result as string;

      // Emitir al servidor
      socketRef.current?.emit("operatorMessage", {
        to: activeChat.clientId,
        type: "image",
        image: base64,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      });

      // Agregar al chat local
      setChats((prev) =>
        prev.map((c) =>
          c.clientId === activeChat.clientId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    from: "operator",
                    image: base64,
                    mimeType: file.type,
                    name: file.name,
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            : c,
        ),
      );

      e.target.value = "";
    };

    reader.readAsDataURL(file);
  };

  const handleOpenCreateClient = () => {
    if (!activeChat) return;
    setClientCreationError(null);
    setClientCreationSuccess(null);
    setNewClientUsername(activeChat.username ?? "");
    setNewClientPhone("");
    setIsCreateClientOpen(true);
  };

  const handleCloseCreateClient = () => {
    if (isCreatingClient) return;
    setIsCreateClientOpen(false);
  };

  const handleCreateClientSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!activeChat) return;

    const username = newClientUsername.trim();
    const phone = newClientPhone.trim();

    if (!username) {
      setClientCreationError("Ingresá un usuario para crear el cliente.");
      return;
    }

    setIsCreatingClient(true);
    setClientCreationError(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          phone: phone.length > 0 ? phone : undefined,
        }),
      });

      let payload: CreateClientApiResponse | null = null;
      try {
        payload = (await response.json()) as CreateClientApiResponse;
      } catch {
        // ignore json parsing errors and fallback to generic message
      }

      if (!response.ok || !payload?.success || !payload.client) {
        throw new Error(payload?.error ?? "No se pudo crear el cliente.");
      }

      setClientCreationSuccess(
        `Cliente ${payload.client.username} creado correctamente.`,
      );
      setNewClientUsername("");
      setNewClientPhone("");
      setIsCreateClientOpen(false);
    } catch (error) {
      console.error("Error creating client from chat", error);
      setClientCreationError(
        error instanceof Error
          ? error.message
          : "No se pudo crear el cliente. Intentá nuevamente.",
      );
      setClientCreationSuccess(null);
    } finally {
      setIsCreatingClient(false);
    }
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

  const handleNoteChange = (value: string) => {
    if (!activeChat) return;
    setChatNotes((prev) => ({
      ...prev,
      [activeChat.clientId]: value,
    }));
  };

  const handleClearNotes = () => {
    if (!activeChat) return;
    setChatNotes((prev) => {
      const updated = { ...prev };
      delete updated[activeChat.clientId];
      return updated;
    });
  };

  const handleQuickReply = (reply: string) => {
    setInput((prev) => {
      if (!prev) return reply;
      const hasTrailingSpace = /\s$/.test(prev);
      return `${hasTrailingSpace ? prev : `${prev} `}${reply}`;
    });
    updateTypingActivity();
  };

  const sidebarStats = [
    { label: "Activos", value: chats.length },
    { label: "Sin leer", value: totalUnread },
    { label: "Escribiendo", value: typingChats },
  ];
  const renderSidebarContent = () => {
    if (chats.length === 0) {
      return (
        <p className="p-4 text-neutral-400 text-center text-sm">
          No hay chats activos
        </p>
      );
    }

    if (filteredChats.length === 0) {
      return (
        <p className="p-4 text-neutral-400 text-center text-sm">
          No hay coincidencias para los filtros aplicados
        </p>
      );
    }

    return filteredChats.map((c) => {
      const isActive = activeClientId === c.clientId;
      const lastMessage =
        c.messages[c.messages.length - 1]?.text ||
        (c.messages[c.messages.length - 1]?.image
          ? "📷 Imagen"
          : "Nuevo chat");

      return (
        <button
          key={c.clientId}
          type="button"
          onClick={() => handleSelectChat(c.clientId)}
          className={`w-full text-left p-4 rounded-xl cursor-pointer transition-all mb-1.5 ${
            isActive
              ? "bg-[#3DAB42] text-white shadow-lg shadow-green-500/20"
              : "border-transparent text-neutral-700 hover:bg-neutral-100"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`font-semibold truncate ${
                isActive ? "text-white" : "text-neutral-900"
              }`}
            >
              {c.username}
            </span>
            {c.unread > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                {c.unread}
              </span>
            )}
          </div>
          <div
            className={`text-sm truncate ${
              isActive ? "text-green-50 opacity-90" : "text-neutral-500"
            }`}
          >
            {lastMessage}
          </div>
          {c.isClientTyping && (
            <div
              className={`mt-1 text-xs font-medium italic ${
                isActive ? "text-white" : "text-[#3DAB42]"
              }`}
            >
              Escribiendo...
            </div>
          )}
        </button>
      );
    });
  };

  // ---------------- RENDER ----------------

  return (
    <>
      <div className="flex h-screen bg-neutral-100 text-base text-neutral-800">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-neutral-200 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="font-semibold text-xl text-neutral-900">
            Chats activos
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
            <span>{statusLabel}</span>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-4 py-4 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <span role="img" aria-hidden className="text-neutral-400">
              🔎
            </span>
            <input
              value={chatSearch}
              onChange={(event) => setChatSearch(event.target.value)}
              className="w-full bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
              placeholder="Buscar por nombre o ID"
            />
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: "Todos", value: "all" },
              { label: "Sin responder", value: "unread" },
              { label: "Escribiendo", value: "typing" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setChatFilter(option.value as typeof chatFilter)
                }
                className={`flex-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  chatFilter === option.value
                    ? "border-[#3DAB42] bg-[#3DAB42]/10 text-[#3DAB42]"
                    : "border-neutral-200 text-neutral-500 hover:bg-neutral-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {sidebarStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-dashed border-neutral-200 px-2 py-2"
              >
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                  {stat.label}
                </p>
                <p className="text-base font-semibold text-neutral-800">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">{renderSidebarContent()}</div>
      </aside>

      {/* Chat Window */}
        <main className="flex-1 flex flex-col bg-neutral-50">
        {activeChat ? (
          <>
            <header className="flex items-center justify-between p-6 bg-white border-b border-neutral-200 shadow-sm">
              <div>
                <div className="font-semibold text-neutral-900 text-lg">
                  Chat con {activeChat.username}
                </div>
                <div className="text-xs text-neutral-500">
                  Cliente ID: {activeChat.clientId}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-neutral-500">
                  Total mensajes: {activeChat.messages.length}
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateClient}
                  className="rounded-lg border border-[#3DAB42]/40 px-4 py-2 text-sm font-semibold text-[#3DAB42] transition-colors hover:bg-[#3DAB42]/10"
                >
                  Crear cliente
                </button>
              </div>
            </header>

            <section className="border-b border-neutral-200 bg-white/70 px-6 py-4">
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-100 bg-white px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Último mensaje
                    </p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {lastMessageTimeLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-100 bg-white px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      De cliente
                    </p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {activeChat.messages.filter((m) => m.from === "client").length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-100 bg-white px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      Adjuntos
                    </p>
                    <p className="text-sm font-semibold text-neutral-900">
                      {totalImagesInChat}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-500">
                    <span>Notas rápidas</span>
                    {activeChatNotes && (
                      <button
                        type="button"
                        onClick={handleClearNotes}
                        className="text-[#3DAB42] transition hover:text-green-700"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <textarea
                    value={activeChatNotes}
                    onChange={(event) => handleNoteChange(event.target.value)}
                    placeholder="Anotá contexto o recordatorios para este chat"
                    className="h-24 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 transition focus:border-[#3DAB42] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {(clientCreationError || clientCreationSuccess) && (
              <div
                className={`px-6 py-3 text-sm border-b ${
                  clientCreationError
                    ? "bg-red-50 text-red-700 border-red-100"
                    : "bg-green-50 text-green-700 border-green-100"
                }`}
              >
                {clientCreationError ?? clientCreationSuccess}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-100">
              {activeChat.messages.map((m, i) => {
                const isOperator = m.from === "operator";

                return (
                  <div
                    key={i}
                    className={`max-w-[75%] ${
                      isOperator ? "ml-auto" : "mr-auto"
                    }`}
                  >
                    <div
                      className={`p-4 rounded-2xl break-words text-sm ${
                        isOperator
                          ? "bg-[#3DAB42] text-white shadow-lg shadow-green-600/20 rounded-br-lg"
                          : "bg-white text-neutral-800 shadow-sm border border-neutral-200 rounded-bl-lg"
                      }`}
                    >
                      {/* 🆕 Render imagen si existe */}
                      {m.image && (
                        <div className="mb-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.image}
                            alt={m.name || "Imagen"}
                            className="rounded-lg max-h-64 w-auto cursor-pointer"
                            onClick={() => {
                              window.open(m.image, "_blank");
                            }}
                          />
                          {m.name && (
                            <div className="mt-1 text-[11px] opacity-80">
                              {m.name}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Texto si hay */}
                      {m.text && <div>{renderMessageText(m.text)}</div>}

                      {m.timestamp && (
                        <span
                          className={`block text-[11px] mt-2 text-right ${
                            isOperator ? "text-white/90" : "text-neutral-400"
                          }`}
                        >
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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

            <div className="border-t border-neutral-200 bg-white/70 px-4 py-3">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Respuestas rápidas</span>
                <span>{QUICK_REPLIES.length} sugerencias</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => handleQuickReply(reply)}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-[#3DAB42] hover:text-[#3DAB42]"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>

            {/* Input + botones */}
            <form
              onSubmit={sendMessage}
              className="flex items-center gap-3 border-t border-neutral-200 bg-white p-4"
            >
              {/* 🆕 Botón imagen */}
              <button
                type="button"
                onClick={handleImageButtonClick}
                className="h-12 w-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-xl hover:bg-neutral-200 transition-all"
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
                className="flex-1 p-4 outline-none text-neutral-800 bg-neutral-100 rounded-xl border border-neutral-200 transition-all focus:bg-white focus:ring-2 focus:ring-[#3DAB42]"
                placeholder="Escribí tu mensaje..."
                value={input}
                onChange={handleInputChange}
              />
              <button
                type="submit"
                className="bg-[#3DAB42] text-white rounded-xl h-14 w-14 flex items-center justify-center text-2xl font-semibold transition-all hover:bg-green-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>

      {isCreateClientOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleCloseCreateClient}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 space-y-1">
              <h3 className="text-xl font-semibold text-neutral-900">
                Crear cliente en CRM
              </h3>
              <p className="text-sm text-neutral-500">
                Registrá a {activeChat?.username ?? "este contacto"} sin salir del
                chat.
              </p>
            </div>
            <form onSubmit={handleCreateClientSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="chat-new-client-username"
                  className="text-sm font-medium text-neutral-700"
                >
                  Usuario
                </label>
                <input
                  id="chat-new-client-username"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 focus:border-[#3DAB42] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3DAB42]/30"
                  value={newClientUsername}
                  onChange={(event) => setNewClientUsername(event.target.value)}
                  placeholder="Ej: cliente123"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="chat-new-client-phone"
                  className="text-sm font-medium text-neutral-700"
                >
                  Teléfono (opcional)
                </label>
                <input
                  id="chat-new-client-phone"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 focus:border-[#3DAB42] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3DAB42]/30"
                  value={newClientPhone}
                  onChange={(event) => setNewClientPhone(event.target.value)}
                  placeholder="Ej: +54 9 11 1234-5678"
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseCreateClient}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingClient}
                  className="rounded-xl bg-[#3DAB42] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingClient ? "Creando..." : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
