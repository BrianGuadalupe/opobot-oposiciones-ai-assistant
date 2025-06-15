
import React from "react";
import { ChatMessage } from "@/hooks/useChat";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface BubbleProps {
  message: ChatMessage;
}
const ChatBubbleMessage: React.FC<BubbleProps> = ({ message }) => {
  const isUser = message.role === "user";

  // Normaliza saltos de línea excesivos
  const normalizedContent = message.content.replace(/\n{3,}/g, '\n\n');

  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`
        max-w-xl md:max-w-2xl px-4 py-3 rounded-2xl text-base font-normal whitespace-pre-line
        ${isUser
          ? "bg-opobot-blue text-white self-end rounded-br-md shadow"
          : "bg-white text-gray-900 border border-gray-200 self-start rounded-bl-md shadow-sm"}
      `}
        style={{ wordBreak: "break-word" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center ${isUser ? "bg-opobot-blue/80" : "bg-gradient-to-br from-opobot-blue to-opobot-green"}`}>
            {isUser
              ? <User className="w-4 h-4 text-white" />
              : <Bot className="w-4 h-4 text-white" />}
          </span>
          <span className="text-xs text-gray-400 font-mono">{message.timestamp.toLocaleTimeString()}</span>
        </div>
        <ReactMarkdown
          components={{
            h1: ({node, ...props}) => <h1 className="text-lg font-semibold mt-3 mb-2 leading-snug" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-base font-semibold mt-3 mb-1 leading-snug" {...props} />,
            h3: ({node, ...props}) => <h3 className="font-semibold mt-2 mb-1 leading-tight" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc ml-6 my-1 space-y-1" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal ml-6 my-1 space-y-1" {...props} />,
            li: ({node, ...props}) => <li className="mb-0.5 leading-relaxed" {...props} />,
            p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
            strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
            em: ({node, ...props}) => <em className="italic text-gray-700" {...props} />,
            blockquote: ({node, ...props}) => (
              <blockquote className="border-l-4 border-opobot-blue pl-3 text-gray-700 italic my-2 leading-relaxed" {...props} />
            ),
            pre: ({node, ...props}) => (
              <pre className="bg-gray-100 rounded p-3 my-2 text-sm overflow-x-auto leading-relaxed" {...props} />
            ),
            code: ({node, ...props}) => (
              <code className="bg-gray-100 rounded px-1.5 py-0.5 text-xs font-mono" {...props} />
            ),
          }}
        >
          {normalizedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ChatBubbleMessage;
