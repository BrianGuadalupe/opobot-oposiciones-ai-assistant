
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { Textarea } from "@/components/ui/textarea";
import ChatBubbleMessage from './ChatBubbleMessage';
import ChatAIThinking from './ChatAIThinking';

const ChatInterface = () => {
  const [inputMessage, setInputMessage] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const { messages, sendMessage, clearMessages, isLoading } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollableContainer = useRef<HTMLDivElement>(null);

  // Auto-scroll as ChatGPT: scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (scrollableContainer.current) {
      const { scrollHeight, clientHeight, scrollTop } = scrollableContainer.current;
      setShowScrollToBottom(scrollHeight - (scrollTop + clientHeight) > 150);
    }
  }, [messages, isLoading]);

  // Handler for auto-grow textarea and Enter/Shift+Enter
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Enviar mensaje
  const handleSubmit = async () => {
    if (!inputMessage.trim() || isLoading) return;
    await sendMessage(inputMessage);
    setInputMessage('');
  };

  // Scroll button
  const handleScroll = () => {
    if (!scrollableContainer.current) return;
    const { scrollHeight, clientHeight, scrollTop } = scrollableContainer.current;
    setShowScrollToBottom(scrollHeight - (scrollTop + clientHeight) > 150);
  };

  return (
    <div className="flex-1 flex flex-col h-screen w-full relative">
      {/* Bloque de mensajes */}
      <div
        ref={scrollableContainer}
        className="flex-1 overflow-y-auto pt-8 pb-36 px-2 sm:px-0 sm:max-w-2xl mx-auto w-full"
        style={{ background: "#f7f7fb" }}
        onScroll={handleScroll}
      >
        {messages.length === 0 && !isLoading ? (
          <div className="h-full flex flex-col justify-center items-center text-center text-gray-400 select-none">
            <span className="text-4xl mb-2">💬</span>
            <h2 className="font-semibold text-gray-900 text-lg mb-2">Comienza tu conversación</h2>
            <p className="text-[15px] text-gray-500 mb-6">Hazle cualquier pregunta<br />sobre oposiciones o legislación.</p>
            <div className="bg-white p-4 rounded-lg w-full max-w-xs text-sm border text-gray-700">
              <span className="mb-2 block">Ejemplos:</span>
              <ul className="space-y-1 list-disc list-inside text-gray-600 text-left">
                <li>¿Cuáles son los requisitos para ser funcionario?</li>
                <li>Explícame el artículo 14 de la Constitución.</li>
                <li>¿Cómo preparo un recurso administrativo?</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col">
            {messages.map((message) => (
              <ChatBubbleMessage key={message.id} message={message} />
            ))}
            {isLoading && <ChatAIThinking />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {/* Caja de texto abajo, fijo. Botón alineado al lado del textarea como ChatGPT */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#f7f7fb]/95 backdrop-blur flex justify-center py-5 px-2 border-t border-gray-100 z-30">
        <div className="w-full sm:max-w-2xl mx-auto flex gap-2 items-end">
          <form
            onSubmit={e => { e.preventDefault(); handleSubmit(); }}
            className="flex w-full gap-2 items-end"
            autoComplete="off"
            style={{}}
          >
            <div className="flex-1 flex">
              <Textarea
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Escribe tu mensaje…"
                rows={1}
                className="resize-none w-full min-h-[44px] max-h-44 text-base px-4 py-3 shadow-sm border border-gray-300 rounded-xl bg-white transition-all focus-visible:ring-1 focus-visible:ring-opobot-blue placeholder:text-gray-400"
                disabled={isLoading}
                autoFocus
                spellCheck
                tabIndex={0}
                aria-label="Escribe tu mensaje"
              />
            </div>
            <Button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
              className="bg-opobot-blue text-white rounded-xl shadow-none transition hover:bg-opobot-blue-dark focus-visible:outline border border-opobot-blue"
              aria-label="Enviar"
              tabIndex={0}
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
