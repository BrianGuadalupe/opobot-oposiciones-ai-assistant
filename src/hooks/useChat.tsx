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

      console.log('✅ Limit check passed, proceeding with response...');

      // DESPUÉS: Respuesta directa inmediata
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `¡Hola! Soy Opobot. Tu mensaje fue: "${content}"...`,
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

console.log('🧪 TEST 1: Conectividad básica - INICIANDO');
fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/chat-opobot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ 
    message: 'test básico',
    conversationHistory: []
  })
})
.then(response => {
  console.log(' Status:', response.status);
  console.log('📡 Headers:', Object.fromEntries(response.headers.entries()));
  return response.text();
})
.then(data => {
  console.log('📡 Response:', data);
  console.log('✅ TEST 1 completado');
})
.catch(error => {
  console.error('❌ TEST 1 error:', error);
});

console.log('🧪 TEST 2: Con token de prueba - INICIANDO');
fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/chat-opobot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test_token_invalid'
  },
  body: JSON.stringify({ 
    message: 'test con token inválido',
    conversationHistory: []
  })
})
.then(response => {
  console.log(' Status:', response.status);
  return response.text();
})
.then(data => {
  console.log('📡 Response:', data);
  console.log('✅ TEST 2 completado');
})
.catch(error => {
  console.error('❌ TEST 2 error:', error);
});

console.log('🧪 TEST 3: Con token real - INICIANDO');
if (typeof window !== 'undefined' && window.supabase) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      console.log('🔑 Token encontrado, probando...');
      fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/chat-opobot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          message: 'test con token real',
          conversationHistory: []
        })
      })
      .then(response => {
        console.log(' Status:', response.status);
        return response.text();
      })
      .then(data => {
        console.log('📡 Response:', data);
        console.log('✅ TEST 3 completado');
      })
      .catch(error => {
        console.error('❌ TEST 3 error:', error);
      });
    } else {
      console.log('❌ No hay sesión activa para TEST 3');
    }
  });
} else {
  console.log('❌ Supabase no disponible para TEST 3');
}

console.log('🧪 TEST 4: Test de timeout - INICIANDO');
const controller = new AbortController();
const timeoutId = setTimeout(() => {
  console.log('⏰ Timeout de 10 segundos alcanzado');
  controller.abort();
}, 10000);

fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/chat-opobot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ 
    message: 'test de timeout',
    conversationHistory: []
  }),
  signal: controller.signal
})
.then(response => {
  clearTimeout(timeoutId);
  console.log(' Status:', response.status);
  return response.text();
})
.then(data => {
  console.log('📡 Response:', data);
  console.log('✅ TEST 4 completado');
})
.catch(error => {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    console.log('⏰ TEST 4: Timeout alcanzado');
  } else {
    console.error('❌ TEST 4 error:', error);
  }
});

console.log('🧪 TEST 5: Test de CORS - INICIANDO');
fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/chat-opobot', {
  method: 'OPTIONS'
})
.then(response => {
  console.log('📡 CORS Status:', response.status);
  console.log('📡 CORS Headers:', Object.fromEntries(response.headers.entries()));
  console.log('✅ TEST 5 completado');
})
.catch(error => {
  console.error('❌ TEST 5 error:', error);
});
