
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
  const { session, user } = useAuth();
  const { toast } = useToast();
  const { registerQuestion } = useFrequentQuestions();
  const { checkQueryLimit, logQuery } = useQueryLimits();
  const { isReady: subscriptionReady } = useSubscription();

  const sendMessage = async (content: string) => {
    console.log('=== SEND MESSAGE START ===');
    console.log('Message:', content.substring(0, 50) + '...');
    console.log('Session:', !!session);
    console.log('User:', !!user);
    console.log('Subscription ready:', subscriptionReady);

    // Verificaciones básicas de autenticación
    if (!session || !user) {
      console.log('❌ No session or user');
      toast({ 
        title: "Error", 
        description: "Debes iniciar sesión para usar el chat", 
        variant: "destructive" 
      });
      return;
    }

    // Verificación crítica: solo proceder si la suscripción está lista
    if (!subscriptionReady) {
      console.log('❌ Subscription not ready yet');
      toast({ 
        title: "Un momento...", 
        description: "Verificando tu suscripción, intenta de nuevo en unos segundos", 
        variant: "default" 
      });
      return;
    }

    setIsLoading(true);
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    registerQuestion(content);

    try {
      // Verificar límites solo cuando todo esté listo
      console.log('🔍 Checking query limits...');
      const limitCheck = await checkQueryLimit();
      
      if (!limitCheck.canProceed) {
        console.log('❌ Query limit exceeded:', limitCheck);
        toast({ 
          title: "🚫 Límite Alcanzado", 
          description: limitCheck.message || "Has alcanzado el límite de consultas", 
          variant: "destructive" 
        });
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      console.log('✅ Limit check passed, proceeding with chat...');

      const conversationHistory = [...messages, userMessage].map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }));

      console.log('🤖 Calling chat-opobot...');
      const { data, error } = await supabase.functions.invoke('chat-opobot', {
        body: { message: content, conversationHistory },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.success || !data?.message) {
        throw new Error(data?.error || error?.message || "Error en el chat");
      }

      console.log('✅ Chat response received');

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      // Log de la query (en background)
      logQuery(content, data.message.length).catch(err => {
        console.error('❌ Error logging query:', err);
      });

      console.log('✅ Message sent successfully');

    } catch (error: any) {
      console.error('❌ Error in sendMessage:', error);
      toast({ 
        title: "Error en el Chat", 
        description: error.message || "No se pudo enviar el mensaje", 
        variant: "destructive" 
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    sendMessage,
    clearMessages: () => setMessages([]),
    isLoading
  };
};
