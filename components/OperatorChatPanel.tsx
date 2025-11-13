"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ---------------- TYPES ----------------
// (Types are unchanged)
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
  isClientTypFing?: boolean;
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

  // (All hooks and logic are unchanged)
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
                isClientTyping: false,
              }
            : c,
        ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ---------------- STYLES MODIFIED BELOW ----------------

  return (
    // --- MODIFIED: Base is now a warm, light gray. Larger base text ---
    <div className="flex h-screen bg-neutral-100 text-base text-neutral-800">
      {/* Sidebar */}
      {/* --- MODIFIED: Fixed width, white BG, warmer border color --- */}
      <aside className="w-80 bg-white border-r border-neutral-200 flex flex-col overflow-y-auto">
        {/* --- MODIFIED: More padding, larger text --- */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="font-semibold text-xl text-neutral-900">
            Chats activos
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
            <span>{statusLabel}</span>
          </div>
        </div>

        {chats.length === 0 && (
          <p className="p-4 text-neutral-400 text-center text-sm">
            No hay chats activos
          </p>
        )}

        {/* --- MODIFIED: More padding around the list --- */}
        <div className="flex-1 overflow-y-auto p-3">
          {chats.map((c) => {
            const isActive = activeClientId === c.clientId;
            const lastMessage =
              c.messages[c.messages.length - 1]?.text || "Nuevo chat";

            return (
              <button
                key={c.clientId}
                type="button"
                onClick={() => handleSelectChat(c.clientId)}
                /* --- MODIFIED: Warmer colors, "glow" shadow on active --- */
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
          })}
        </div>
      </aside>

      {/* Chat Window */}
      {/* --- MODIFIED: Softer bg-neutral-50 --- */}
      <main className="flex-1 flex flex-col bg-neutral-50">
        {activeChat ? (
          <>
            {/* --- MODIFIED: More padding, subtle shadow --- */}
            <header className="flex items-center justify-between p-6 bg-white border-b border-neutral-200 shadow-sm">
              <div>
                <div className="font-semibold text-neutral-900 text-lg">
                  Chat con {activeChat.username}
                </div>
                <div className="text-xs text-neutral-500">
                  Cliente ID: {activeChat.clientId}
                </div>
              </div>
              <div className="text-xs text-neutral-500">
                Total mensajes: {activeChat.messages.length}
              </div>
            </header>

            {/* --- MODIFIED: bg-neutral-100 to match page, more space --- */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-100">
              {activeChat.messages.map((m, i) => (
                <div
                  key={i}
                  /* --- MODIFIED: "Bubbly" (rounded-2xl) + asymmetric radius + "glow" --- */
                  className={`p-4 rounded-2xl max-w-[75%] break-words text-sm ${
                    m.from === "operator"
                      ? "bg-[#3DAB42] text-white ml-auto shadow-lg shadow-green-600/20 rounded-br-lg"
                      : "bg-white text-neutral-800 mr-auto shadow-sm border border-neutral-200 rounded-bl-lg"
                  }`}
                >
                  {m.text}
                  {m.timestamp && (
                    <span
                      className={`block text-[11px] mt-2 text-right ${
                        m.from === "operator"
                          ? "text-white/90"
                          : "text-neutral-400"
                      }`}
                    >
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              ))}

              {activeChat.isClientTyping && (
                <div className="mr-auto text-sm text-neutral-500 italic">
                  {activeChat.username} está escribiendo...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* --- MODIFIED: New input/button layout --- */}
            <form
              onSubmit={sendMessage}
              className="flex items-center gap-4 border-t border-neutral-200 bg-white p-4"
            >
              <input
                className="flex-1 p-4 outline-none text-neutral-800 bg-neutral-100 rounded-xl border border-neutral-200 transition-all focus:bg-white focus:ring-2 focus:ring-[#3DAB42]"
                placeholder="Escribí tu mensaje..."
                value={input}
                onChange={handleInputChange}
              />
              <button
                type="submit"
                className="bg-[#3DAB42] text-white rounded-xl h-14 w-14 flex items-center justify-center text-2xl font-semibold transition-all hover:bg-green-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={
                  !connectionStatus || connectionStatus === "disconnected"
                }
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          /* --- MODIFIED: Warmer empty state --- */
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
  );
}
