
import React from "react";
import { ChatMessage } from "@/hooks/useChat";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface BubbleProps {
  message: ChatMessage;
}
const ChatBubbleMessage: React.FC<BubbleProps> = ({ message }) => {
  const isUser = message.role === "user";
  return (
    <div className={`w-full flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`
        max-w-xl md:max-w-2xl px-4 py-3 rounded-2xl text-base font-normal whitespace-pre-line
        ${isUser
          ? "bg-opobot-blue text-white self-end rounded-br-md shadow"
          : "bg-white text-gray-900 border border-gray-200 self-start rounded-bl-md shadow-sm"}
      `}
        style={{ wordBreak: "break-word" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center ${isUser ? "bg-opobot-blue/80" : "bg-gradient-to-br from-opobot-blue to-opobot-green"}`}>
            {isUser
              ? <User className="w-4 h-4 text-white" />
              : <Bot className="w-4 h-4 text-white" />}
          </span>
          <span className="text-xs text-gray-400 font-mono">{message.timestamp.toLocaleTimeString()}</span>
        </div>
        <ReactMarkdown
          components={{
            strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
            em: ({node, ...props}) => <em className="italic text-gray-700" {...props} />,
            li: ({node, ...props}) => <li className="ml-4 list-disc" {...props} />
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ChatBubbleMessage;
