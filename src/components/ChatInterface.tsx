
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import { useChat, ChatMessage } from '@/hooks/useChat';

const ChatInterface = () => {
  const [inputMessage, setInputMessage] = useState('');
  const { messages, sendMessage, clearMessages, isLoading } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    await sendMessage(inputMessage);
    setInputMessage('');
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, index) => (
      <span key={index}>
        {line}
        {index < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-opobot-blue to-opobot-green rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Opobot Assistant</h2>
              <p className="text-sm text-gray-600">Tu asistente especializado en oposiciones</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Limpiar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              ¡Hola! Soy Opobot
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Estoy aquí para ayudarte con tus estudios de oposiciones. Puedes preguntarme sobre 
              legislación, temarios, procedimientos administrativos y mucho más.
            </p>
            <div className="mt-6 text-sm text-gray-500">
              <p className="mb-2">💡 Ejemplos de preguntas:</p>
              <ul className="space-y-1">
                <li>"¿Cuáles son los requisitos para ser Auxiliar Administrativo?"</li>
                <li>"Explícame el artículo 14 de la Constitución"</li>
                <li>"¿Cómo funciona el procedimiento administrativo común?"</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} />
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-white shadow-sm max-w-xs">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-opobot-blue" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-opobot-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4 rounded-b-lg">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Escribe tu pregunta sobre oposiciones..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-opobot-blue hover:bg-opobot-blue-dark"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

const ChatMessageComponent: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <Card className={`max-w-2xl shadow-sm ${isUser ? 'bg-opobot-blue text-white' : 'bg-white'}`}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isUser ? 'bg-white/20' : 'bg-gradient-to-r from-opobot-blue to-opobot-green'
            }`}>
              {isUser ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-gray-800'}`}>
                {message.content.split('\n').map((line, index) => (
                  <span key={index}>
                    {line}
                    {index < message.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </p>
              <p className={`text-xs mt-2 ${isUser ? 'text-white/70' : 'text-gray-500'}`}>
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatInterface;
