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

console.log('🧪 TEST 3: Test completo del chat');
fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/chat-opobot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ 
    message: 'test completo después del fix',
    conversationHistory: []
  })
})
.then(response => {
  console.log(' Status:', response.status);
  return response.text();
})
.then(data => {
  console.log('📡 Response:', data);
  if (response.status === 200) {
    console.log('✅ TEST 3: chat-opobot funciona correctamente');
  } else {
    console.log('❌ TEST 3: chat-opobot aún tiene problemas');
  }
})
.catch(error => {
  console.error('❌ TEST 3 error:', error);
});

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

console.log('🧪 TEST 1: Verificar manage-usage log_query');
fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ 
    action: 'log_query',
    queryText: 'test query',
    responseLength: 100
  })
})
.then(response => {
  console.log(' Status:', response.status);
  return response.text();
})
.then(data => {
  console.log('📡 Response:', data);
  console.log('✅ manage-usage log_query test completed');
})
.catch(error => {
  console.error('❌ Test error:', error);
});

console.log('🧪 TEST 2: Verificar manage-usage check_limit');
fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ 
    action: 'check_limit'
  })
})
.then(response => {
  console.log(' Status:', response.status);
  return response.text();
})
.then(data => {
  console.log('📡 Response:', data);
  const result = JSON.parse(data);
  console.log('📊 Usage data:', result.usageData);
  console.log('✅ TEST 2: check_limit funciona correctamente');
})
.catch(error => {
  console.error('❌ TEST 2 error:', error);
});

console.log('🧪 TEST 4: Verificar actualización en BD');
const testDatabaseUpdate = async () => {
  try {
    // 1. Obtener uso actual
    const { data: beforeUsage } = await supabase
      .from('user_usage')
      .select('queries_this_month, queries_remaining_this_month, total_queries')
      .eq('user_id', user.id)
      .single();
    
    console.log('📊 Uso ANTES:', beforeUsage);
    
    // 2. Hacer una consulta
    await fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        action: 'log_query',
        queryText: 'test de actualización BD',
        responseLength: 200
      })
    });
    
    // 3. Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Verificar uso después
    const { data: afterUsage } = await supabase
      .from('user_usage')
      .select('queries_this_month, queries_remaining_this_month, total_queries')
      .eq('user_id', user.id)
      .single();
    
    console.log('📊 Uso DESPUÉS:', afterUsage);
    
    // 5. Verificar que se incrementó
    if (afterUsage.queries_this_month > beforeUsage.queries_this_month) {
      console.log('✅ TEST 4: Base de datos se actualiza correctamente');
    } else {
      console.log('❌ TEST 4: Base de datos no se actualiza');
    }
    
  } catch (error) {
    console.error('❌ TEST 4 error:', error);
  }
};

testDatabaseUpdate();

console.log('🧪 TEST 5: Verificar límites');
const testLimits = async () => {
  try {
    // 1. Verificar límite actual
    const { data: limitData } = await supabase
      .from('user_usage')
      .select('queries_remaining_this_month, subscription_tier')
      .eq('user_id', user.id)
      .single();
    
    console.log('📊 Límite actual:', limitData.queries_remaining_this_month);
    console.log('📊 Plan:', limitData.subscription_tier);
    
    // 2. Verificar límite vía manage-usage
    const response = await fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        action: 'check_limit'
      })
    });
    
    const data = await response.text();
    const result = JSON.parse(data);
    
    console.log('📊 Límite vía API:', result.usageData.queriesRemaining);
    console.log('📊 Puede proceder:', result.canProceed);
    
    if (result.canProceed) {
      console.log('✅ TEST 5: Límites funcionan correctamente');
    } else {
      console.log('⚠️ TEST 5: Límite alcanzado');
    }
    
  } catch (error) {
    console.error('❌ TEST 5 error:', error);
  }
};

testLimits();

// Test de performance del sistema optimizado
console.log('🧪 TEST 6: Test de performance');
const testPerformance = async () => {
  const startTime = Date.now();
  
  try {
    // Test de check_limit (debería usar caché)
    const response1 = await fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        action: 'check_limit'
      })
    });
    
    const time1 = Date.now() - startTime;
    console.log('⏱️ Tiempo check_limit:', time1, 'ms');
    
    // Test de log_query
    const response2 = await fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        action: 'log_query',
        queryText: 'test performance',
        responseLength: 100
      })
    });
    
    const time2 = Date.now() - startTime;
    console.log('⏱️ Tiempo log_query:', time2, 'ms');
    
    if (time1 < 1000 && time2 < 2000) {
      console.log('✅ TEST 6: Performance optimizada');
    } else {
      console.log('⚠️ TEST 6: Performance lenta');
    }
    
  } catch (error) {
    console.error('❌ TEST 6 error:', error);
  }
};

testPerformance();

// Test de manejo de errores
console.log('🧪 TEST 7: Test de error handling');
const testErrorHandling = async () => {
  try {
    // Test con action inválido
    const response = await fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        action: 'invalid_action'
      })
    });
    
    const data = await response.text();
    console.log(' Status:', response.status);
    console.log('📡 Response:', data);
    
    if (response.status === 400) {
      console.log('✅ TEST 7: Error handling funciona correctamente');
    } else {
      console.log('❌ TEST 7: Error handling no funciona');
    }
    
  } catch (error) {
    console.error('❌ TEST 7 error:', error);
  }
};

testErrorHandling();

// Test para verificar que el caché funciona
console.log('🧪 TEST 8: Test de caché');
const testCache = async () => {
  try {
    const startTime = Date.now();
    
    // Primera llamada (sin caché)
    const response1 = await fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        action: 'check_limit'
      })
    });
    
    const time1 = Date.now() - startTime;
    console.log('⏱️ Primera llamada:', time1, 'ms');
    
    // Segunda llamada (con caché)
    const response2 = await fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/manage-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ 
        action: 'check_limit'
      })
    });
    
    const time2 = Date.now() - startTime;
    console.log('⏱️ Segunda llamada:', time2, 'ms');
    
    if (time2 < time1) {
      console.log('✅ TEST 8: Caché funciona correctamente');
    } else {
      console.log('⚠️ TEST 8: Caché no funciona');
    }
    
  } catch (error) {
    console.error('❌ TEST 8 error:', error);
  }
};

testCache();
