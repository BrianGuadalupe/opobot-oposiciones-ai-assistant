
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface UsageData {
  queriesUsed: number;
  queriesRemaining: number;
  usagePercentage: number;
  monthlyLimit: number;
}

interface LimitCheckResult {
  canProceed: boolean;
  reason: string;
  message?: string;
  usageData?: UsageData;
}

export const useQueryLimits = () => {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkQueryLimit = async (): Promise<LimitCheckResult> => {
    console.log('=== QUERY LIMIT CHECK START ===');
    console.log('👤 User exists:', !!user);
    console.log('🔐 Session exists:', !!session);

    if (!session || !user) {
      console.log('❌ No session or user for limit check');
      return {
        canProceed: false,
        reason: 'no_auth',
        message: 'Debes iniciar sesión para usar el chat'
      };
    }

    try {
      setIsLoading(true);
      
      console.log('🔍 Calling manage-usage for check_limit...');
      console.log('🔐 Using access token:', session.access_token ? 'EXISTS' : 'MISSING');
      
      // Ultra-aggressive timeout - 5 seconds max
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('manage-usage timeout after 5 seconds')), 5000);
      });
      
      const callPromise = supabase.functions.invoke('manage-usage', {
        body: { action: 'check_limit' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('⏳ Starting manage-usage call with 5s timeout...');
      const { data, error } = await Promise.race([callPromise, timeoutPromise]) as any;

      console.log('📥 Manage-usage response received');
      console.log('📥 Response error:', error);
      console.log('📥 Response data:', data);

      if (error) {
        console.error('❌ Error in manage-usage function:', error);
        throw error;
      }

      // Verificar que la respuesta tenga la estructura esperada
      if (!data || typeof data !== 'object') {
        console.error('❌ Invalid response structure:', data);
        throw new Error('Respuesta inválida del servidor');
      }

      if (typeof data.canProceed === 'undefined') {
        console.error('❌ Missing canProceed property:', data);
        throw new Error('Respuesta inválida del servidor');
      }

      console.log('✅ Valid response structure confirmed');
      console.log('✅ canProceed:', data.canProceed);
      console.log('✅ reason:', data.reason);

      const canProceed = Boolean(data.canProceed);
      const result: LimitCheckResult = {
        canProceed: canProceed,
        reason: data.reason || 'unknown',
        message: data.message,
        usageData: data.usageData
      };
      
      console.log('✅ Processed result:', result);
      
      if (result.usageData) {
        setUsageData(result.usageData);
        console.log('📊 Updated usage data:', result.usageData);
      }

      // Mostrar advertencias apropiadas
      if (result.reason === 'demo_warning_90') {
        toast({
          title: "⚠️ Demo - Límite Cercano",
          description: result.message,
          variant: "default",
        });
      }

      if (result.reason === 'warning_90') {
        toast({
          title: "⚠️ Límite de Consultas",
          description: result.message,
          variant: "default",
        });
      }

      console.log('✅ Limit check completed successfully');
      return result;
    } catch (error) {
      console.error('💥 Error checking query limit:', error);
      console.error('💥 Error message:', error?.message);
      
      if (error?.message?.includes('timeout')) {
        console.error('⏰ TIMEOUT ERROR - manage-usage took too long');
        toast({
          title: "Error de Tiempo",
          description: "La verificación tardó demasiado. Intenta de nuevo.",
          variant: "destructive",
        });
      }
      
      return {
        canProceed: false,
        reason: 'error',
        message: 'Error al verificar límite de consultas'
      };
    } finally {
      setIsLoading(false);
      console.log('🏁 Query limit check process completed');
    }
  };

  const logQuery = async (queryText: string, responseLength: number) => {
    if (!session || !user) {
      console.log('❌ No session or user for logging query');
      return;
    }

    try {
      console.log('📝 Logging query to manage-usage...');
      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { 
          action: 'log_query',
          queryText,
          responseLength 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('❌ Error logging query:', error);
      } else {
        console.log('✅ Query logged successfully:', data);
        // Actualizar datos de uso después de registrar
        await loadUsageData();
      }
    } catch (error) {
      console.error('💥 Error logging query:', error);
    }
  };

  const loadUsageData = async () => {
    if (!session || !user) {
      console.log('❌ No session or user for loading usage data');
      return;
    }

    try {
      console.log('📊 Loading usage data...');
      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { action: 'get_usage' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('❌ Error loading usage data:', error);
        throw error;
      }
      
      if (data) {
        const newUsageData = {
          queriesUsed: data.queries_this_month || 0,
          queriesRemaining: data.queries_remaining_this_month || 0,
          usagePercentage: data.usage_percentage || 0,
          monthlyLimit: (data.queries_this_month || 0) + (data.queries_remaining_this_month || 0)
        };
        console.log('📊 Loaded usage data:', newUsageData);
        setUsageData(newUsageData);
      }
    } catch (error) {
      console.error('💥 Error loading usage data:', error);
    }
  };

  useEffect(() => {
    if (session && user) {
      console.log('🔄 Loading initial usage data...');
      loadUsageData();
    }
  }, [session, user]);

  return {
    usageData,
    isLoading,
    checkQueryLimit,
    logQuery,
    loadUsageData
  };
};
