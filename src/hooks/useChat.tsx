import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFrequentQuestions } from './useFrequentQuestions';
import { useQueryLimits } from './useQueryLimits';
import { useSubscription } from './useSubscription';
import { useDemoRegistration } from './useDemoRegistration';
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { session, user, signUp, signIn } = useAuth();
  const { toast } = useToast();
  const { registerQuestion } = useFrequentQuestions();
  const { checkQueryLimit, logQuery, initialCheckComplete } = useQueryLimits();
  const { isReady: subscriptionReady } = useSubscription();
  const { showSubscriptionModal } = useDemoRegistration();
  const navigate = useNavigate();

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
      // Verificar límites
      const limitCheck = await checkQueryLimit(false);
      
      if (!limitCheck.canProceed) {
        // Verificar si es demo agotado
        if (limitCheck.usageData?.monthlyLimit === 3 && limitCheck.usageData?.queriesRemaining === 0) {
          showSubscriptionModal();
        } else {
          toast({ 
            title: "Límite Alcanzado", 
            description: limitCheck.message || "Has alcanzado el límite de consultas", 
            variant: "destructive" 
          });
        }
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      console.log('✅ Limit check passed, calling OpenAI API...');

      // Llamar directamente a la Edge Function usando fetch
      const response = await fetch('https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/chat-opobot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: content
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error calling chat-opobot:', response.status, errorText);
        throw new Error(`Error al procesar tu mensaje: ${response.status}`);
      }

      const data = await response.json();
      
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

  // 🚀 CAMBIO MÍNIMO: Mostrar pantalla especial si ya está autenticado
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">
              ¡Ya estás autenticado!
            </CardTitle>
            <CardDescription>
              {isDemo ? "Activando tu demo gratuito..." : "Redirigiendo a tu cuenta..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">Hola <strong>{user.email}</strong></p>
            {isDemo && (
              <Button onClick={handleDemoActivation} className="w-full bg-opobot-blue hover:bg-opobot-blue-dark">
                Activar Demo
              </Button>
            )}
            <Button onClick={() => navigate('/')} variant="outline" className="w-full mt-2">
              Ir al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return {
    messages,
    sendMessage,
    clearMessages: () => setMessages([]),
    isLoading
  };
};
