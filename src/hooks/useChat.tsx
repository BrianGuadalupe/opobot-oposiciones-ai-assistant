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
  const { checkQueryLimit, logQuery, initialCheckComplete } = useQueryLimits();
  const { isReady: subscriptionReady } = useSubscription();

  const sendMessage = async (content: string) => {
    console.log('=== SEND MESSAGE START ===');
    console.log('📝 Message content:', content.substring(0, 50) + '...');
    console.log('👤 Session present:', !!session);
    console.log('👤 User present:', !!user);
    console.log('✅ Subscription ready:', subscriptionReady);
    console.log('🔍 Initial check complete:', initialCheckComplete);
    console.log('🔑 Access token present:', !!session?.access_token);

    // Verificaciones básicas de autenticación
    if (!session || !user) {
      console.log('❌ EARLY EXIT: No session or user');
      toast({ 
        title: "Error", 
        description: "Debes iniciar sesión para usar el chat", 
        variant: "destructive" 
      });
      return;
    }

    // Verificar que la suscripción esté lista
    if (!subscriptionReady) {
      console.log('❌ EARLY EXIT: Subscription not ready yet');
      toast({ 
        title: "Un momento...", 
        description: "Verificando tu suscripción, intenta de nuevo en unos segundos", 
        variant: "default" 
      });
      return;
    }

    // Verificar que el sistema de límites esté listo
    if (!initialCheckComplete) {
      console.log('❌ EARLY EXIT: Limit system not ready yet');
      toast({ 
        title: "Un momento...", 
        description: "Verificando límites de uso, intenta de nuevo en unos segundos", 
        variant: "default" 
      });
      return;
    }

    console.log('✅ All systems ready, proceeding with message...');

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
      // 🚀 OPTIMIZACIÓN: Verificar límites solo si es necesario
      console.log('🔍 About to check query limits...');
      const limitCheck = await checkQueryLimit(false);
      console.log(' Limit check result:', limitCheck);
      
      if (!limitCheck.canProceed) {
        console.log('❌ EARLY EXIT: Query limit check failed -', limitCheck.reason);
        toast({ 
          title: " Límite Alcanzado", 
          description: limitCheck.message || "Has alcanzado el límite de consultas", 
          variant: "destructive" 
        });
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      console.log('✅ Limit check passed, calling OpenAI API...');

      // Preparar historial de conversación para OpenAI
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Llamar a la Edge Function chat-opobot
      const { data, error } = await supabase.functions.invoke('chat-opobot', {
        body: {
          message: content,
          conversationHistory: conversationHistory
        }
      });

      if (error) {
        console.error('❌ Error calling chat-opobot:', error);
        throw new Error(error.message || 'Error al procesar tu mensaje');
      }

      if (!data?.success) {
        console.error('❌ Chat API returned error:', data?.error);
        throw new Error(data?.error || 'Error al procesar tu mensaje');
      }

      console.log('✅ OpenAI response received:', data.message.substring(0, 100) + '...');

      // Crear mensaje del asistente con la respuesta real de OpenAI
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      // 🚀 OPTIMIZACIÓN: Log de la query en background
      console.log('📝 Logging query usage...');
      logQuery(content, assistantMessage.content.length).catch(err => {
        console.error('❌ Error logging query (non-critical):', err);
      });

      console.log('✅ Message sent and processed successfully');

    } catch (error: any) {
      console.error('💥 CRITICAL ERROR in sendMessage:', error);
      console.error('💥 Error message:', error.message);
      
      toast({ 
        title: "Error en el Chat", 
        description: error.message || "No se pudo enviar el mensaje", 
        variant: "destructive" 
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      console.log('🏁 sendMessage completed (success or error)');
    }
  };

  return {
    messages,
    sendMessage,
    clearMessages: () => setMessages([]),
    isLoading
  };
};
