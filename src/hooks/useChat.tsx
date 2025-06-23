
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFrequentQuestions } from './useFrequentQuestions';
import { useQueryLimits } from './useQueryLimits';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();
  const { toast } = useToast();
  const { registerQuestion } = useFrequentQuestions();
  const { checkQueryLimit, logQuery } = useQueryLimits();

  const sendMessage = async (content: string) => {
    console.log('=== CHAT SEND MESSAGE START ===');
    console.log('Content:', content);
    console.log('Session exists:', !!session);

    if (!session) {
      console.log('❌ No session for chat');
      toast({
        title: "Error",
        description: "Debes iniciar sesión para usar el chat",
        variant: "destructive",
      });
      return;
    }

    console.log('🔍 Checking query limit...');
    // Verificar límite antes de procesar
    const limitCheck = await checkQueryLimit();
    console.log('✅ Limit check result:', limitCheck);
    
    if (!limitCheck.canProceed) {
      console.log('🚫 Cannot proceed with query:', limitCheck.reason);
      if (limitCheck.reason === 'limit_reached') {
        toast({
          title: "🚫 Límite Alcanzado",
          description: limitCheck.message || "Has alcanzado el límite de consultas mensuales",
          variant: "destructive",
        });
      } else if (limitCheck.reason === 'no_subscription') {
        toast({
          title: "Suscripción Requerida",
          description: limitCheck.message || "Necesitas una suscripción activa",
          variant: "destructive",
        });
      } else if (limitCheck.reason === 'demo_limit_reached') {
        toast({
          title: "🚫 Demo Completado",
          description: limitCheck.message || "Has alcanzado el límite de 3 consultas del Demo",
          variant: "destructive",
        });
      }
      return;
    }

    console.log('✅ Can proceed with chat message');
    setIsLoading(true);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      console.log('📝 Registering question...');
      registerQuestion(content);

      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      console.log('🤖 Calling chat-opobot function...');
      const { data, error } = await supabase.functions.invoke('chat-opobot', {
        body: {
          message: content,
          conversationHistory
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('✅ Chat-opobot response received:', { 
        hasData: !!data, 
        hasError: !!error,
        success: data?.success 
      });

      if (error) {
        console.error('❌ Error from chat-opobot:', error);
        throw error;
      }

      if (!data.success) {
        console.error('❌ Chat-opobot returned unsuccessful response:', data.error);
        throw new Error(data.error || 'Error desconocido');
      }

      console.log('📤 Creating assistant message...');
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      console.log('📊 Logging query...');
      // Registrar la consulta después de completarse exitosamente
      await logQuery(content, data.message.length);
      console.log('✅ Query logged successfully');

    } catch (error) {
      console.error('💥 Error in chat flow:', error);
      console.error('💥 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });

      // Remover el mensaje del usuario en caso de error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      console.log('🏁 Chat send message completed');
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    sendMessage,
    clearMessages,
    isLoading
  };
};
