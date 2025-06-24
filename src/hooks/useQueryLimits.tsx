
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
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  const fetchFromManageUsage = async (action: string, body: any = {}): Promise<any> => {
    if (!session) throw new Error('No session');

    const { data, error } = await supabase.functions.invoke('manage-usage', {
      body: { action, ...body },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) throw error;
    return data;
  };

  const checkQueryLimit = async (): Promise<LimitCheckResult> => {
    if (!user || !session) {
      return { canProceed: false, reason: 'no_auth', message: 'Debes iniciar sesión para usar el chat' };
    }

    try {
      setIsLoading(true);
      const data = await fetchFromManageUsage('check_limit');

      const result: LimitCheckResult = {
        canProceed: !!data?.canProceed,
        reason: data?.reason || 'unknown',
        message: data?.message,
        usageData: data?.usageData,
      };

      if (result.usageData) setUsageData(result.usageData);
      return result;
    } catch (err: any) {
      toast({ title: 'Error', description: `Error al verificar límites: ${err.message || 'desconocido'}`, variant: 'destructive' });
      return { canProceed: false, reason: 'error', message: err.message || 'Error desconocido' };
    } finally {
      setIsLoading(false);
    }
  };

  const logQuery = async (queryText: string, responseLength: number) => {
    if (!user || !session) return;
    try {
      await fetchFromManageUsage('log_query', { queryText, responseLength });
    } catch (err) {
      console.error('Error logging query:', err);
    }
  };

  const loadUsageData = async () => {
    try {
      const result = await checkQueryLimit();
      if (result.usageData) setUsageData(result.usageData);
    } catch (err) {
      console.error('Error loading usage data:', err);
    }
  };

  useEffect(() => {
    if (session && user && !initialCheckComplete) {
      loadUsageData().finally(() => setInitialCheckComplete(true));
    }
  }, [session, user]);

  return {
    usageData,
    isLoading,
    checkQueryLimit,
    logQuery,
    loadUsageData,
  };
};
