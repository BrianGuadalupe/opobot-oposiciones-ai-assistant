
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
      
      console.log('🔍 Calling manage-usage function...');
      
      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { action: 'check_limit' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

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
      
      toast({
        title: "Error",
        description: "Error al verificar límites de uso",
        variant: "destructive",
      });
      
      return {
        canProceed: false,
        reason: 'error',
        message: 'Error al verificar límites de uso'
      };
    } finally {
      setIsLoading(false);
      console.log('🏁 Query limit check process completed');
    }
  };

  const logQuery = async (queryText: string, responseLength: number) => {
    console.log('📝 Logging query...');
    
    if (!session || !user) {
      console.log('❌ No session for query logging');
      return;
    }

    try {
      await supabase.functions.invoke('manage-usage', {
        body: { 
          action: 'log_query',
          queryText,
          responseLength 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      console.log('✅ Query logged successfully');
    } catch (error) {
      console.error('❌ Error logging query:', error);
    }
  };

  const loadUsageData = async () => {
    console.log('📊 Loading usage data...');
    
    if (!session || !user) {
      console.log('❌ No session for usage data');
      return;
    }

    try {
      const result = await checkQueryLimit();
      if (result.usageData) {
        setUsageData(result.usageData);
      }
    } catch (error) {
      console.error('❌ Error loading usage data:', error);
    }
  };

  useEffect(() => {
    console.log('🔄 useQueryLimits useEffect triggered');
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
