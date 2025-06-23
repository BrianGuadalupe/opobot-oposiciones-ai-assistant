
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
    console.log('User:', !!user);
    console.log('Session:', !!session);

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
      
      console.log('🔍 Invoking manage-usage function for check_limit...');
      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { action: 'check_limit' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('📥 Manage-usage raw response:', { 
        hasData: !!data, 
        hasError: !!error,
        dataKeys: data ? Object.keys(data) : [],
        errorMessage: error?.message
      });

      if (error) {
        console.error('❌ Error in manage-usage function:', error);
        throw error;
      }

      // Verificar que la respuesta tenga la estructura esperada
      if (!data || typeof data.canProceed === 'undefined') {
        console.error('❌ Invalid response structure from manage-usage:', data);
        throw new Error('Respuesta inválida del servidor');
      }

      console.log('✅ Manage-usage response processed:', {
        canProceed: data.canProceed,
        reason: data.reason,
        hasUsageData: !!data.usageData
      });

      const result: LimitCheckResult = data;
      
      if (result.usageData) {
        setUsageData(result.usageData);
        console.log('📊 Updated usage data:', result.usageData);
      }

      // Mostrar advertencias para demo
      if (result.reason === 'demo_warning_90') {
        toast({
          title: "⚠️ Demo - Límite Cercano",
          description: result.message,
          variant: "default",
        });
      }

      if (result.reason === 'demo_limit_reached') {
        toast({
          title: "🚫 Demo Completado",
          description: result.message,
          variant: "destructive",
        });
      }

      // Mostrar advertencias para plan básico
      if (result.reason === 'warning_90') {
        toast({
          title: "⚠️ Límite de Consultas",
          description: result.message,
          variant: "default",
        });
      }

      if (result.reason === 'limit_reached') {
        toast({
          title: "🚫 Límite Alcanzado",
          description: result.message,
          variant: "destructive",
        });
      }

      console.log('✅ Limit check completed successfully:', result);
      return result;
    } catch (error) {
      console.error('💥 Error checking query limit:', error);
      console.error('💥 Error stack:', error.stack);
      return {
        canProceed: false,
        reason: 'error',
        message: 'Error al verificar límite de consultas'
      };
    } finally {
      setIsLoading(false);
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
          queriesUsed: data.queries_this_month,
          queriesRemaining: data.queries_remaining_this_month,
          usagePercentage: data.usage_percentage,
          monthlyLimit: data.queries_this_month + data.queries_remaining_this_month
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
