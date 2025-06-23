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
      
      console.log('🔍 About to invoke manage-usage function for check_limit...');
      console.log('🔐 Using access token:', session.access_token ? 'EXISTS' : 'MISSING');
      
      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { action: 'check_limit' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('📥 Manage-usage response received');
      console.log('📥 Response error:', error);
      console.log('📥 Response data type:', typeof data);
      console.log('📥 Response data is null/undefined:', data == null);
      
      if (data) {
        console.log('📥 Response data keys:', Object.keys(data));
        console.log('📥 Raw response data:', JSON.stringify(data, null, 2));
      }

      if (error) {
        console.error('❌ Error in manage-usage function:', error);
        throw error;
      }

      // Verificar que la respuesta tenga la estructura esperada
      if (!data || typeof data !== 'object') {
        console.error('❌ Invalid response structure from manage-usage - not an object:', data);
        throw new Error('Respuesta inválida del servidor');
      }

      if (typeof data.canProceed === 'undefined') {
        console.error('❌ Missing canProceed property in response:', data);
        throw new Error('Respuesta inválida del servidor - falta canProceed');
      }

      console.log('✅ Valid response structure confirmed');
      console.log('✅ canProceed raw value:', data.canProceed);
      console.log('✅ canProceed type:', typeof data.canProceed);
      console.log('✅ reason:', data.reason);

      // Asegurar que canProceed es explícitamente boolean
      const canProceed = Boolean(data.canProceed);
      console.log('✅ canProceed converted to boolean:', canProceed);

      const result: LimitCheckResult = {
        canProceed: canProceed,
        reason: data.reason || 'unknown',
        message: data.message,
        usageData: data.usageData
      };
      
      console.log('✅ Processed result:', JSON.stringify(result, null, 2));
      
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

      if (result.reason === 'demo_limit_reached') {
        toast({
          title: "🚫 Demo Completado",
          description: result.message,
          variant: "destructive",
        });
      }

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

      console.log('✅ Limit check completed successfully, returning result');
      console.log('✅ Final canProceed value being returned:', result.canProceed);
      return result;
    } catch (error) {
      console.error('💥 Error checking query limit:', error);
      console.error('💥 Error message:', error?.message);
      console.error('💥 Error stack:', error?.stack);
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
