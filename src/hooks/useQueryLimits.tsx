
import { useState, useEffect, useRef } from 'react';
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

// Control de concurrencia fuera del hook para evitar múltiples llamadas
let isChecking = false;
let lastCheckResult: LimitCheckResult | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 3000; // 3 segundos de caché

export const useQueryLimits = () => {
  const { session, user } = useAuth();
  const { toast } = useToast();

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  const fetchFromManageUsage = async (action: string, body: any = {}): Promise<any> => {
    if (!session) throw new Error('No session');

    console.log(`🔄 Calling manage-usage with action: ${action}`);
    
    const { data, error } = await supabase.functions.invoke('manage-usage', {
      body: { action, ...body },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      console.error('❌ manage-usage error:', error);
      throw error;
    }
    
    console.log(`✅ manage-usage ${action} response:`, data);
    return data;
  };

  const checkQueryLimit = async (): Promise<LimitCheckResult> => {
    console.log('=== CHECK QUERY LIMIT START ===');
    
    if (!user || !session) {
      console.log('❌ No user or session for limit check');
      return { 
        canProceed: false, 
        reason: 'no_auth', 
        message: 'Debes iniciar sesión para usar el chat' 
      };
    }

    // Control de concurrencia
    if (isChecking) {
      console.log('⚠️ Limit check already in progress, returning cached or waiting state');
      return lastCheckResult || {
        canProceed: false,
        reason: 'already_checking',
        message: 'Ya se está verificando el límite. Espera un momento.',
      };
    }

    // Verificar caché
    const now = Date.now();
    if (lastCheckResult && (now - lastCheckTime) < CACHE_DURATION) {
      console.log('📋 Using cached limit check result');
      return lastCheckResult;
    }

    isChecking = true;
    setIsLoading(true);
    
    try {
      console.log('🔍 Performing fresh limit check...');
      const data = await fetchFromManageUsage('check_limit');

      const result: LimitCheckResult = {
        canProceed: !!data?.canProceed,
        reason: data?.reason || 'unknown',
        message: data?.message,
        usageData: data?.usageData,
      };

      // Actualizar caché
      lastCheckResult = result;
      lastCheckTime = now;

      if (result.usageData) {
        setUsageData(result.usageData);
      }

      console.log('✅ Limit check completed:', result);
      return result;
      
    } catch (err: any) {
      console.error('❌ Error in checkQueryLimit:', err);
      toast({ 
        title: 'Error', 
        description: `Error al verificar límites: ${err.message || 'desconocido'}`, 
        variant: 'destructive' 
      });
      
      const errorResult: LimitCheckResult = {
        canProceed: false,
        reason: 'error',
        message: err.message || 'Error desconocido'
      };
      
      // No cachear errores, pero liberar el lock
      lastCheckResult = null;
      return errorResult;
      
    } finally {
      isChecking = false;
      setIsLoading(false);
    }
  };

  const logQuery = async (queryText: string, responseLength: number) => {
    if (!user || !session) return;
    
    try {
      console.log('📝 Logging query usage...');
      await fetchFromManageUsage('log_query', { queryText, responseLength });
      
      // Invalidar caché después de log para que el próximo check sea fresh
      lastCheckResult = null;
      lastCheckTime = 0;
      
    } catch (err) {
      console.error('❌ Error logging query:', err);
    }
  };

  const loadUsageData = async () => {
    try {
      console.log('📊 Loading usage data...');
      const result = await checkQueryLimit();
      if (result.usageData) {
        setUsageData(result.usageData);
      }
    } catch (err) {
      console.error('❌ Error loading usage data:', err);
    }
  };

  useEffect(() => {
    if (session && user && !initialCheckComplete) {
      console.log('🚀 Initial usage data load...');
      loadUsageData().finally(() => {
        setInitialCheckComplete(true);
        console.log('✅ Initial check completed');
      });
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
