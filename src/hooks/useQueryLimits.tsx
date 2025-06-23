
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
  const { session } = useAuth();
  const { toast } = useToast();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkQueryLimit = async (): Promise<LimitCheckResult> => {
    if (!session) {
      return {
        canProceed: false,
        reason: 'no_auth',
        message: 'Debes iniciar sesión para usar el chat'
      };
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { action: 'check_limit' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      const result: LimitCheckResult = data;
      
      if (result.usageData) {
        setUsageData(result.usageData);
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

      return result;
    } catch (error) {
      console.error('Error checking query limit:', error);
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
    if (!session) return;

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

      // Actualizar datos de uso después de registrar
      await loadUsageData();
    } catch (error) {
      console.error('Error logging query:', error);
    }
  };

  const loadUsageData = async () => {
    if (!session) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-usage', {
        body: { action: 'get_usage' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data) {
        setUsageData({
          queriesUsed: data.queries_this_month,
          queriesRemaining: data.queries_remaining_this_month,
          usagePercentage: data.usage_percentage,
          monthlyLimit: data.queries_this_month + data.queries_remaining_this_month
        });
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
    }
  };

  useEffect(() => {
    if (session) {
      loadUsageData();
    }
  }, [session]);

  return {
    usageData,
    isLoading,
    checkQueryLimit,
    logQuery,
    loadUsageData
  };
};
