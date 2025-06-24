
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

    // NUEVA VERIFICACIÓN: Esperar tanto suscripción como verificación inicial de límites
    if (!subscriptionReady) {
      console.log('❌ EARLY EXIT: Subscription not ready yet');
      toast({ 
        title: "Un momento...", 
        description: "Verificando tu suscripción, intenta de nuevo en unos segundos", 
        variant: "default" 
      });
      return;
    }

    if (!initialCheckComplete) {
      console.log('❌ EARLY EXIT: Initial limit check not complete yet');
      toast({ 
        title: "Un momento...", 
        description: "Verificando tus límites de uso, intenta de nuevo en unos segundos", 
        variant: "default" 
      });
      return;
    }

    console.log('✅ All pre-checks passed, proceeding with message...');
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
      // Verificar límites con refresh forzado para asegurar datos actuales
      console.log('🔍 About to check query limits with forced refresh...');
      const limitCheck = await checkQueryLimit(true);
      console.log('🔍 Limit check result:', limitCheck);
      
      if (!limitCheck.canProceed) {
        console.log('❌ EARLY EXIT: Query limit check failed -', limitCheck.reason);
        toast({ 
          title: "🚫 Límite Alcanzado", 
          description: limitCheck.message || "Has alcanzado el límite de consultas", 
          variant: "destructive" 
        });
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      console.log('✅ Limit check passed, proceeding with chat-opobot call...');

      const conversationHistory = [...messages, userMessage].map(msg => ({ 
        role: msg.role, 
        content: msg.content 
      }));

      console.log('🤖 About to call chat-opobot function...');
      console.log('🤖 Conversation history length:', conversationHistory.length);

      // Preparar el cuerpo de la petición
      const requestBody = { 
        message: content, 
        conversationHistory 
      };

      console.log('📦 Request body prepared:', {
        hasMessage: !!requestBody.message,
        messageLength: requestBody.message.length,
        historyLength: requestBody.conversationHistory.length
      });

      // Timeout para la llamada
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.log('⏰ TIMEOUT: chat-opobot call exceeded 30 seconds');
          reject(new Error('Timeout: El asistente no respondió en 30 segundos'));
        }, 30000);
      });

      console.log('🚀 Invoking chat-opobot function now...');
      const chatPromise = supabase.functions.invoke('chat-opobot', {
        body: requestBody,
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('⏳ Waiting for chat-opobot response...');
      const { data, error } = await Promise.race([chatPromise, timeoutPromise]) as any;

      console.log('📡 Raw response received from chat-opobot');
      console.log('📡 Error object:', error);
      console.log('📡 Data object:', data);

      if (error) {
        console.error('❌ Supabase function error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Error de conexión con chat-opobot: ${error.message}`);
      }

      if (!data) {
        console.error('❌ No data received from chat-opobot');
        throw new Error('No se recibió respuesta del asistente (data is null/undefined)');
      }

      console.log('🔍 Analyzing response structure...');
      console.log('🔍 data.success:', data.success);
      console.log('🔍 data.message present:', !!data.message);

      if (!data.success) {
        console.error('❌ Function returned success=false');
        console.error('❌ Error from function:', data.error);
        throw new Error(data.error || "Error en el chat - función reportó fallo");
      }

      if (!data.message) {
        console.error('❌ Function returned success=true but no message');
        throw new Error("El asistente no devolvió un mensaje válido");
      }

      console.log('✅ Valid response received from chat-opobot');
      console.log('✅ Message preview:', data.message.substring(0, 100) + '...');

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      // Log de la query (en background)
      console.log('📝 Logging query usage...');
      logQuery(content, data.message.length).catch(err => {
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
