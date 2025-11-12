"use client";
import { useEffect, useState } from "react";
import io from "socket.io-client";

let socket;

export default function OperatorChatPanel() {
  const [chats, setChats] = useState([]); // {clientId, username, messages: []}
  const [activeChat, setActiveChat] = useState(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    socket = io("https://backend.tu-dominio.com", {
      path: "/chat",
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("✅ Conectado como operador");
      socket.emit("join", { role: "operator", name: "Operador 1" });
    });

    socket.on("newChat", (data) => {
      setChats((prev) => {
        if (prev.find((c) => c.clientId === data.clientId)) return prev;
        return [...prev, { ...data, messages: [] }];
      });
    });

    socket.on("incomingMessage", (data) => {
      setChats((prev) =>
        prev.map((c) =>
          c.clientId === data.from
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { from: "client", text: data.message },
                ],
              }
            : c,
        ),
      );
    });

    return () => socket.disconnect();
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input || !activeChat) return;
    socket.emit("operatorMessage", { to: activeChat.clientId, message: input });
    setChats((prev) =>
      prev.map((c) =>
        c.clientId === activeChat.clientId
          ? {
              ...c,
              messages: [...c.messages, { from: "operator", text: input }],
            }
          : c,
      ),
    );
    setInput("");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-1/4 bg-white border-r overflow-y-auto">
        <h2 className="font-bold p-4 border-b">Chats activos</h2>
        {chats.map((c) => (
          <div
            key={c.clientId}
            onClick={() => setActiveChat(c)}
            className={`p-3 cursor-pointer hover:bg-gray-100 ${
              activeChat?.clientId === c.clientId ? "bg-gray-200" : ""
            }`}
          >
            {c.username}
          </div>
        ))}
      </div>

      {/* Chat window */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <div className="p-3 bg-[#3DAB42] text-white font-semibold">
              Chat con {activeChat.username}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
              {activeChat.messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg max-w-[70%] ${
                    m.from === "operator"
                      ? "bg-[#3DAB42]/90 text-white ml-auto"
                      : "bg-gray-200 text-gray-800 mr-auto"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="flex border-t">
              <input
                className="flex-1 p-2 outline-none"
                placeholder="Escribí tu mensaje..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                className="bg-[#3DAB42] text-white px-4 font-semibold"
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Seleccioná un chat
          </div>
        )}
      </div>
    </div>
  );
}
