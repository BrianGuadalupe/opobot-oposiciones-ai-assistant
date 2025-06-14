
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import { useChat, ChatMessage } from '@/hooks/useChat';
import ReactMarkdown from 'react-markdown';

const ChatInterface = () => {
  const [inputMessage, setInputMessage] = useState('');
  const { messages, sendMessage, clearMessages, isLoading } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-grow textarea
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = (inputRef.current.scrollHeight) + "px";
    }
  }, [inputMessage, isLoading]);

  // Scroll siempre abajo en cada nuevo mensaje 
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;
    await sendMessage(inputMessage);
    setInputMessage('');
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  // Abrir/ejecutar comando rápido
  const handleSpecialCommand = async (command: string) => {
    if (isLoading) return;
    await sendMessage(command);
    setInputMessage('');
  };

  return (
    <div className="flex flex-col h-[80vh] max-h-[650px] mx-auto w-full max-w-2xl bg-[#e7eaf3] rounded-2xl shadow-md border border-gray-200">
      {/* Header minimalista */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 bg-[#f8fafc] rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-opobot-blue to-opobot-green rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 leading-tight">Opobot Assistant</h2>
            <p className="text-xs text-gray-500">Especialista en oposiciones</p>
          </div>
        </div>
        {messages.length > 0 &&
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            title="Limpiar conversación"
            className="text-gray-400 hover:bg-gray-100"
            >
            <Trash2 className="w-5 h-5" />
          </Button>
        }
      </div>
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-2 bg-[#e7eaf3] transition-all">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center pt-10 animate-fade-in">
            <Bot className="w-14 h-14 text-gray-300 mb-3" />
            <h3 className="text-base font-semibold text-gray-700 mb-1">¡Hola! Soy Opobot</h3>
            <p className="text-xs text-gray-500 mb-4">
              Estoy aquí para ayudarte con tus estudios de oposiciones.<br />
              Pregúntame sobre legislación, temarios o técnicas de estudio.
            </p>
            <div className="bg-white p-4 rounded-lg shadow-sm text-left w-full max-w-xs text-[13px] border">
              <span className="mb-2 text-gray-700 block">💡 Ejemplos:</span>
              <ul className="space-y-1 text-gray-600">
                <li>– ¿Cuáles son los requisitos para ser Auxiliar?</li>
                <li>– Explícame el artículo 14 de la Constitución.</li>
                <li>– ¿Cómo funciona el proceso de recurso administrativo?</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((message, idx) => (
              <FadeIn key={message.id}>
                <BubbleMessage message={message} />
              </FadeIn>
            ))}
            {isLoading && (
              <FadeIn>
                <BubbleAIThinking />
              </FadeIn>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      {/* Barra inferior con comandos rápidos + input */}
      <div className="p-4 bg-[#f8fafc] border-t border-gray-200 rounded-b-2xl">
        {/* Comandos rápidos solo si hay mensajes o input */}
        {(messages.length > 0 || !!inputMessage.trim()) && (
          <div className="flex gap-2 mb-4">
            <Button
              variant="secondary"
              size="sm"
              className="px-3 py-1"
              onClick={() => handleSpecialCommand('Hazme un test de este tema')}
              disabled={isLoading}
            >
              <span role="img" aria-label="Test">📝</span> Test
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="px-3 py-1"
              onClick={() => handleSpecialCommand('Resúmeme este tema')}
              disabled={isLoading}
            >
              <span role="img" aria-label="Resumen">📄</span> Resumen
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            placeholder="Escribe tu pregunta…"
            rows={1}
            className="resize-none min-h-[44px] max-h-36 pr-10 bg-white border border-gray-300 shadow-inner placeholder:text-gray-400 transition-all"
            disabled={isLoading}
            autoFocus
            spellCheck
          />
          <Button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="absolute bottom-2 right-2 px-2 py-1 rounded shadow-none bg-opobot-blue hover:bg-opobot-blue-dark text-white"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

const FadeIn: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <div className="animate-fade-in">{children}</div>
);

// Mensaje burbuja estilo chatgpt
const BubbleMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`
        max-w-[85%] md:max-w-[70%] p-3 rounded-xl text-sm leading-relaxed
        ${isUser
          ? 'ml-auto bg-opobot-blue text-white rounded-br-md shadow'
          : 'mr-auto bg-white text-gray-900 border border-gray-200 rounded-bl-md shadow-sm'}
      `}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center bg-white/30 ${isUser ? 'order-2' : 'order-1 bg-gradient-to-br from-opobot-blue to-opobot-green'}`}>
            {isUser
              ? <User className="w-4 h-4 text-opobot-blue" />
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

const BubbleAIThinking = () => (
  <div className="flex justify-start">
    <div className="max-w-[70%] bg-white text-gray-800 border border-gray-200 rounded-xl p-3 shadow-sm flex items-center gap-2">
      <Bot className="w-5 h-5 text-opobot-blue animate-bounce" />
      <span className="flex space-x-1">
        <span className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
        <span className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
      </span>
      <span className="text-xs text-gray-400 ml-2">Pensando…</span>
    </div>
  </div>
);

export default ChatInterface;
