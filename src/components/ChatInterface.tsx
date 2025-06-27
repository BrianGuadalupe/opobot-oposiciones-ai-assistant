import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RotateCcw, Home, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useFrequentQuestions } from '@/hooks/useFrequentQuestions';
import ChatBubbleMessage from './ChatBubbleMessage';
import ChatAIThinking from './ChatAIThinking';
import UsageIndicator from './UsageIndicator';
import { useNavigate } from 'react-router-dom';

const ChatInterface = () => {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const { messages, sendMessage, clearMessages, isLoading } = useChat();
  const { user } = useAuth();
  const { recentQuestions, fetchRecentQuestions } = useFrequentQuestions();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageToSend = input.trim();
    setInput('');
    await sendMessage(messageToSend);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleQuestionClick = (question: string) => {
    setInput(question);
    setShowHistory(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Hace unos minutos';
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    if (diffInHours < 48) return 'Ayer';
    return date.toLocaleDateString('es-ES');
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-opobot-blue to-opobot-green flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Opobot</h1>
              <p className="text-sm text-gray-500">
                Tu asistente personal para oposiciones
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) {
                  fetchRecentQuestions();
                }
              }}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Historial
            </Button>
            <Button
              onClick={clearMessages}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Nueva conversación
            </Button>
          </div>
        </div>
      </div>

      {/* Usage Indicator */}
      <div className="px-4 pt-4">
        <UsageIndicator />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Messages */}
        <div className="flex-1 flex flex-col">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  ¡Hola! Soy Opobot 👋
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Estoy aquí para ayudarte con tus dudas sobre la oposición de Auxiliar Administrativo del Estado. 
                  ¿En qué puedo ayudarte hoy?
                </p>
              </div>
            )}

            {messages.map((message) => (
              <ChatBubbleMessage 
                key={message.id} 
                message={message} 
              />
            ))}

            {isLoading && <ChatAIThinking />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="border-t border-gray-200 bg-white p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu pregunta sobre oposiciones..."
                className="flex-1 min-h-[60px] max-h-32 resize-none"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-6 bg-opobot-blue hover:bg-opobot-blue/90"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Opobot puede cometer errores. Verifica la información importante.
            </p>
          </div>
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Preguntas Recientes
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {recentQuestions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    No hay preguntas recientes
                  </p>
                </div>
              ) : (
                recentQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="bg-white rounded-lg p-3 border border-gray-200 hover:border-opobot-blue cursor-pointer transition-colors"
                    onClick={() => handleQuestionClick(question.question)}
                  >
                    <p className="text-sm text-gray-900 line-clamp-2 mb-2">
                      {question.question}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatDate(question.created_at)}</span>
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        {question.times_asked} vez{question.times_asked !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
