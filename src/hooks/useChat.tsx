
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
    console.log('📝 Content:', content);
    console.log('👤 Session exists:', !!session);

    if (!session) {
      console.log('❌ No session for chat');
      toast({
        title: "Error",
        description: "Debes iniciar sesión para usar el chat",
        variant: "destructive",
      });
      return;
    }

    console.log('🔍 Starting limit check process...');
    
    try {
      setIsLoading(true);
      console.log('⏳ About to call checkQueryLimit...');
      
      // Verificar límite antes de procesar
      const limitCheck = await checkQueryLimit();
      
      console.log('✅ checkQueryLimit completed successfully');
      console.log('📊 Limit check result type:', typeof limitCheck);
      console.log('📊 Limit check keys:', limitCheck ? Object.keys(limitCheck) : 'null/undefined');
      console.log('📊 Full limit check result:', JSON.stringify(limitCheck, null, 2));
      
      // Verificar que tenemos una respuesta válida
      if (!limitCheck) {
        console.log('❌ No limit check response received - limitCheck is null/undefined');
        toast({
          title: "Error",
          description: "Error al verificar límite de consultas",
          variant: "destructive",
        });
        return;
      }
      
      console.log('📊 canProceed raw value:', limitCheck.canProceed);
      console.log('📊 canProceed type:', typeof limitCheck.canProceed);
      console.log('📊 canProceed truthiness:', !!limitCheck.canProceed);
      
      // Verificar explícitamente el valor de canProceed
      if (limitCheck.canProceed !== true) {
        console.log('🚫 Cannot proceed with query');
        console.log('🚫 Reason:', limitCheck.reason);
        console.log('🚫 Message:', limitCheck.message);
        
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
        } else {
          toast({
            title: "Error",
            description: limitCheck.message || "No se puede procesar la consulta",
            variant: "destructive",
          });
        }
        return;
      }

      console.log('✅ Can proceed with chat message - starting chat flow');
      console.log('📝 Creating user message...');

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      console.log('📝 Adding user message to state');
      setMessages(prev => [...prev, userMessage]);

      console.log('📝 Registering question with useFrequentQuestions...');
      registerQuestion(content);

      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      console.log('🤖 About to call chat-opobot function...');
      console.log('🤖 Conversation history length:', conversationHistory.length);
      console.log('🤖 Session access token exists:', !!session.access_token);
      
      const { data, error } = await supabase.functions.invoke('chat-opobot', {
        body: {
          message: content,
          conversationHistory
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('✅ Chat-opobot response received');
      console.log('📥 Response data exists:', !!data);
      console.log('📥 Response error exists:', !!error);

      if (error) {
        console.error('❌ Error from chat-opobot:', error);
        throw error;
      }

      console.log('📥 Response data:', data);
      console.log('📥 Response success:', data?.success);

      if (!data?.success) {
        console.error('❌ Chat-opobot returned unsuccessful response:', data?.error);
        throw new Error(data?.error || 'Error desconocido');
      }

      console.log('📤 Creating assistant message...');
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      console.log('📊 Logging query with useQueryLimits...');
      // Registrar la consulta después de completarse exitosamente
      await logQuery(content, data.message.length);
      console.log('✅ Query logged successfully');

    } catch (error) {
      console.error('💥 Error in chat flow:', error);
      console.error('💥 Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
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
