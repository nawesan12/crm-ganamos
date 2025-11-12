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
}

interface NewChatPayload {
  clientId: string;
  username: string;
}

interface IncomingMessagePayload {
  from: string; // clientId
  message: string;
}

// ---------------- COMPONENT ----------------

export default function OperatorChatPanel() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom when new messages arrive
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

    setSocket(s);

    s.on("connect", () => {
      console.log("✅ Conectado como operador");
      s.emit("join", { role: "operator", name: "Operador 1" });
    });

    // When a new chat starts from a client
    s.on("newChat", (data: NewChatPayload) => {
      setChats((prev) => {
        const exists = prev.some((c) => c.clientId === data.clientId);
        if (exists) return prev;
        return [...prev, { ...data, messages: [] }];
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
              }
            : c,
        ),
      );
    });

    // Optional: handle disconnections or chat end events
    s.on("chatEnded", ({ clientId }: { clientId: string }) => {
      setChats((prev) => prev.filter((c) => c.clientId !== clientId));
      if (activeChat?.clientId === clientId) setActiveChat(null);
    });

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChat || !socket) return;

    socket.emit("operatorMessage", {
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

    setInput("");
  };

  return (
    <div className="flex h-screen bg-gray-100 text-sm">
      {/* Sidebar */}
      <aside className="w-1/4 bg-white border-r overflow-y-auto">
        <h2 className="font-bold p-4 border-b text-gray-700">Chats activos</h2>
        {chats.length === 0 && (
          <p className="p-4 text-gray-400 text-center">No hay chats activos</p>
        )}
        {chats.map((c) => (
          <div
            key={c.clientId}
            onClick={() => setActiveChat(c)}
            className={`p-3 cursor-pointer transition-colors ${
              activeChat?.clientId === c.clientId
                ? "bg-green-100 border-l-4 border-green-500"
                : "hover:bg-gray-100"
            }`}
          >
            <div className="font-medium text-gray-800">{c.username}</div>
            <div className="text-xs text-gray-500 truncate">
              {c.messages[c.messages.length - 1]?.text || "Nuevo chat"}
            </div>
          </div>
        ))}
      </aside>

      {/* Chat Window */}
      <main className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <header className="p-3 bg-[#3DAB42] text-white font-semibold">
              Chat con {activeChat.username}
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
              {activeChat.messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg max-w-[75%] break-words ${
                    m.from === "operator"
                      ? "bg-[#3DAB42]/90 text-white ml-auto"
                      : "bg-gray-200 text-gray-800 mr-auto"
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
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="flex border-t bg-white">
              <input
                className="flex-1 p-3 outline-none text-gray-800"
                placeholder="Escribí tu mensaje..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                className="bg-[#3DAB42] text-white px-5 font-semibold hover:bg-[#319a38]"
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Seleccioná un chat para empezar
          </div>
        )}
      </main>
    </div>
  );
}
