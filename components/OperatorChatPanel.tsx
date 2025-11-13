"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ---------------- TYPES ----------------

interface Message {
  from: "client" | "operator";
  text: string;
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
  message: string;
}

interface TypingPayload {
  from: string; // clientId (del lado del operador)
  isTyping: boolean;
}

// ---------------- COMPONENT ----------------

export default function OperatorChatPanel() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Para tener siempre el clientId activo más reciente dentro de los handlers del socket
  const activeClientIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeClientIdRef.current = activeClientId;
  }, [activeClientId]);

  // Timeout para cortar el estado "escribiendo" del operador
  const operatorTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const operatorIsTypingRef = useRef<boolean>(false);

  const activeChat =
    activeClientId != null
      ? (chats.find((c) => c.clientId === activeClientId) ?? null)
      : null;

  // Auto scroll to bottom when active chat messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeChat?.messages.length]);

  // Socket setup
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

    // When a new chat starts from a client
    s.on("newChat", (data: NewChatPayload) => {
      setChats((prev) => {
        const exists = prev.some((c) => c.clientId === data.clientId);
        if (exists) return prev;

        const updated = [
          ...prev,
          { ...data, messages: [], unread: 0, isClientTyping: false },
        ];

        // Si no hay chat activo, seleccionamos el primero que llega
        if (!activeClientIdRef.current && updated.length > 0) {
          setActiveClientId(data.clientId);
        }

        return updated;
      });
    });

    // When a client sends a message
    s.on("incomingMessage", (data: IncomingMessagePayload) => {
      setChats((prev) =>
        prev.map((c) =>
          c.clientId === data.from
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  {
                    from: "client",
                    text: data.message,
                    timestamp: new Date().toISOString(),
                  },
                ],
                unread:
                  activeClientIdRef.current === data.from
                    ? c.unread
                    : c.unread + 1,
                // Cuando llega un mensaje, asumimos que dejó de escribir
                isClientTyping: false,
              }
            : c,
        ),
      );
    });

    // Cliente está escribiendo
    s.on("clientTyping", (data: TypingPayload) => {
      setChats((prev) =>
        prev.map((c) =>
          c.clientId === data.from
            ? { ...c, isClientTyping: data.isTyping }
            : c,
        ),
      );
    });

    // Optional: handle disconnections or chat end events
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectChat = (clientId: string) => {
    setActiveClientId(clientId);
    // limpiar no leídos del chat seleccionado
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Notificar "escribiendo" al cliente
    const socket = socketRef.current;
    if (!socket || !activeClientIdRef.current) return;

    if (!operatorIsTypingRef.current) {
      operatorIsTypingRef.current = true;
      notifyOperatorTyping(true);
    }

    // Reiniciamos el timeout cada vez que escribe
    if (operatorTypingTimeoutRef.current) {
      clearTimeout(operatorTypingTimeoutRef.current);
    }

    operatorTypingTimeoutRef.current = setTimeout(() => {
      operatorIsTypingRef.current = false;
      notifyOperatorTyping(false);
    }, 1500);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChat || !socketRef.current) return;

    socketRef.current.emit("operatorMessage", {
      to: activeChat.clientId,
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

    // Al enviar mensaje, cortamos el estado "escribiendo"
    if (operatorTypingTimeoutRef.current) {
      clearTimeout(operatorTypingTimeoutRef.current);
    }
    operatorIsTypingRef.current = false;
    notifyOperatorTyping(false);

    setInput("");
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

  return (
    <div className="flex h-screen bg-gray-100 text-sm">
      {/* Sidebar */}
      <aside className="w-1/4 bg-white border-r flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-gray-700">Chats activos</h2>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
            <span>{statusLabel}</span>
          </div>
        </div>

        {chats.length === 0 && (
          <p className="p-4 text-gray-400 text-center text-xs">
            No hay chats activos
          </p>
        )}

        <div className="flex-1 overflow-y-auto">
          {chats.map((c) => {
            const isActive = activeClientId === c.clientId;
            const lastMessage =
              c.messages[c.messages.length - 1]?.text || "Nuevo chat";

            return (
              <button
                key={c.clientId}
                type="button"
                onClick={() => handleSelectChat(c.clientId)}
                className={`w-full text-left p-3 cursor-pointer transition-colors border-l-4 ${
                  isActive
                    ? "bg-green-100 border-green-500"
                    : "border-transparent hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 truncate">
                    {c.username}
                  </span>
                  {c.unread > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {lastMessage}
                </div>
                {c.isClientTyping && (
                  <div className="mt-1 text-[10px] text-green-600">
                    Escribiendo...
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat Window */}
      <main className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <header className="flex items-center justify-between p-3 bg-[#3DAB42] text-white">
              <div>
                <div className="font-semibold">
                  Chat con {activeChat.username}
                </div>
                <div className="text-[11px] opacity-80">
                  Cliente ID: {activeChat.clientId}
                </div>
              </div>
              <div className="text-[11px] opacity-90">
                Total mensajes: {activeChat.messages.length}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
              {activeChat.messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg max-w-[75%] break-words shadow-sm ${
                    m.from === "operator"
                      ? "bg-[#3DAB42]/90 text-white ml-auto"
                      : "bg-white text-gray-800 mr-auto border border-gray-200"
                  }`}
                >
                  {m.text}
                  {m.timestamp && (
                    <span className="block text-[10px] opacity-70 mt-1 text-right">
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              ))}

              {/* Indicador de escribiendo del cliente en el panel principal */}
              {activeChat.isClientTyping && (
                <div className="mr-auto text-[11px] text-gray-500 italic">
                  {activeChat.username} está escribiendo...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="flex border-t bg-white">
              <input
                className="flex-1 p-3 outline-none text-gray-800"
                placeholder="Escribí tu mensaje..."
                value={input}
                onChange={handleInputChange}
              />
              <button
                type="submit"
                className="bg-[#3DAB42] text-white px-5 font-semibold hover:bg-[#319a38] disabled:opacity-50"
                disabled={
                  !connectionStatus || connectionStatus === "disconnected"
                }
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <p className="text-sm mb-2">Seleccioná un chat para empezar</p>
            <p className="text-[11px] text-gray-400">
              Cuando un cliente inicie un chat, aparecerá en la lista de la
              izquierda.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
