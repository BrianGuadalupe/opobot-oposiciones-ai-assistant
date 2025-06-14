
import React from "react";
import { Bot } from "lucide-react";

// Animación "escribiendo" del asistente
const ChatAIThinking = () => (
  <div className="w-full flex justify-start mb-2">
    <div className="max-w-xl bg-white text-gray-800 border border-gray-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
      <Bot className="w-5 h-5 text-opobot-blue animate-bounce" />
      <span className="flex space-x-1">
        <span className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce" style={{ animationDelay: "0.12s" }} />
        <span className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce" style={{ animationDelay: "0.24s" }} />
      </span>
      <span className="text-xs text-gray-400 ml-2">Pensando…</span>
    </div>
  </div>
);

export default ChatAIThinking;
