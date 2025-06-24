
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
    console.log('=== SIMPLIFIED QUERY LIMIT CHECK START ===');
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
      
      console.log('🔍 Attempting manage-usage call with minimal timeout...');
      
      // Timeout agresivo de solo 500ms
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('manage-usage timeout after 500ms')), 500);
      });
      
      const callPromise = supabase.functions.invoke('manage-usage', {
        body: { action: 'check_limit' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('⏳ Starting manage-usage call with 500ms timeout...');
      const { data, error } = await Promise.race([callPromise, timeoutPromise]) as any;

      console.log('📥 Manage-usage response received');
      console.log('📥 Response error:', error);
      console.log('📥 Response data:', data);

      if (error) {
        console.error('❌ Error in manage-usage function:', error);
        throw error;
      }

      if (!data || typeof data !== 'object') {
        console.error('❌ Invalid response structure:', data);
        throw new Error('Respuesta inválida del servidor');
      }

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

      console.log('✅ Limit check completed successfully');
      return result;
    } catch (error) {
      console.error('💥 Error checking query limit:', error);
      console.error('💥 Error message:', error?.message);
      
      // FALLBACK: Si hay cualquier error, permitir que continúe
      // Esto es temporal hasta que resolvamos el problema de Supabase Edge Functions
      console.log('🔄 FALLBACK: Allowing query to proceed due to system error');
      
      toast({
        title: "Advertencia",
        description: "Sistema de límites temporalmente deshabilitado",
        variant: "default",
      });
      
      // Simular datos de uso para que la UI funcione
      const fallbackUsageData: UsageData = {
        queriesUsed: 1,
        queriesRemaining: 99,
        usagePercentage: 1.0,
        monthlyLimit: 100
      };
      
      setUsageData(fallbackUsageData);
      
      return {
        canProceed: true,
        reason: 'fallback',
        message: 'Verificación de límites omitida por error del sistema',
        usageData: fallbackUsageData
      };
    } finally {
      setIsLoading(false);
      console.log('🏁 Query limit check process completed');
    }
  };

  const logQuery = async (queryText: string, responseLength: number) => {
    console.log('📝 Skipping query logging for now to avoid issues');
    return;
  };

  const loadUsageData = async () => {
    console.log('📊 Skipping usage data loading for now to avoid issues');
    return;
  };

  useEffect(() => {
    console.log('🔄 useQueryLimits useEffect triggered');
    if (session && user) {
      console.log('🔄 Session and user exist, but skipping initial data load');
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
