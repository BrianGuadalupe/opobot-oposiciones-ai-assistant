
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFrequentQuestions } from './useFrequentQuestions';
import { useQueryLimits } from './useQueryLimits';
import { useSubscription } from './useSubscription';

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
  const { isReady: subscriptionReady, loading: subscriptionLoading } = useSubscription();

  const sendMessage = async (content: string) => {
    console.log('=== CHAT SEND MESSAGE START ===');
    console.log('📝 Content:', content);
    console.log('👤 Session exists:', !!session);
    console.log('🔄 Subscription ready:', subscriptionReady);
    console.log('🔄 Subscription loading:', subscriptionLoading);

    if (!session) {
      console.log('❌ No session for chat');
      toast({
        title: "Error",
        description: "Debes iniciar sesión para usar el chat",
        variant: "destructive",
      });
      return;
    }

    // CLAVE: Esperar a que la suscripción esté lista antes de verificar límites
    if (!subscriptionReady) {
      console.log('⏳ Subscription not ready yet, cannot proceed with chat');
      toast({
        title: "Un momento...",
        description: "Verificando tu suscripción, intenta de nuevo en unos segundos",
        variant: "default",
      });
      return;
    }

    console.log('🔍 Starting limit check process...');
    
    try {
      setIsLoading(true);
      console.log('⏳ About to call checkQueryLimit...');
      
      // Verificar límite después de que la suscripción esté lista
      const limitCheck = await checkQueryLimit();
      
      console.log('✅ checkQueryLimit completed successfully');
      console.log('📊 Limit check result:', JSON.stringify(limitCheck, null, 2));
      
      if (!limitCheck) {
        console.log('❌ No limit check response received');
        toast({
          title: "Error",
          description: "Error al verificar límite de consultas",
          variant: "destructive",
        });
        return;
      }
      
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

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);
      registerQuestion(content);

      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      console.log('🤖 About to call chat-opobot function...');
      
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

      if (error) {
        console.error('❌ Error from chat-opobot:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('❌ Chat-opobot returned unsuccessful response:', data?.error);
        throw new Error(data?.error || 'Error desconocido');
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      console.log('📊 Logging query with useQueryLimits...');
      await logQuery(content, data.message.length);
      console.log('✅ Query logged successfully');

    } catch (error) {
      console.error('💥 Error in chat flow:', error);
      
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
