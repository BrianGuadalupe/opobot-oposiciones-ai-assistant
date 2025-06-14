
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
            h1: ({node, ...props}) => <h1 className="text-lg font-semibold mt-2 mb-2" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-base font-semibold mt-4 mb-2" {...props} />,
            h3: ({node, ...props}) => <h3 className="font-semibold mt-4 mb-2" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc ml-6 my-2 space-y-1" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal ml-6 my-2 space-y-1" {...props} />,
            li: ({node, ...props}) => <li className="mb-1" {...props} />,
            p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props} />,
            strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
            em: ({node, ...props}) => <em className="italic text-gray-700" {...props} />,
            blockquote: ({node, ...props}) => (
              <blockquote className="border-l-4 border-opobot-blue pl-3 text-gray-700 italic my-3" {...props} />
            ),
            pre: ({node, ...props}) => (
              <pre className="bg-gray-100 rounded p-2 my-2 text-sm overflow-x-auto" {...props} />
            ),
            code: ({node, ...props}) => (
              <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono" {...props} />
            ),
            // fallback: any other markdown syntax
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ChatBubbleMessage;

