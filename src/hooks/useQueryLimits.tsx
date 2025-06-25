
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

const CACHE_DURATION = 30000; // 30 segundos
const SUPABASE_URL = "https://dozaqjmdoblwqnuprxnq.supabase.co";

export const useQueryLimits = () => {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const { session, user } = useAuth();
  const { toast } = useToast();

  let lastCheckResult: LimitCheckResult | null = null;
  let lastCheckTime = 0;
  let isChecking = false;

  const fetchFromManageUsage = async (action: string, body: any = {}): Promise<any> => {
    if (!session?.access_token) {
      throw new Error('No access token available');
    }

    console.log(`🔄 Calling manage-usage with action: ${action}`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-usage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...body }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ manage-usage error: ${response.status} - ${errorText}`);
      throw new Error(`manage-usage error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ manage-usage ${action} response:`, data);
    return data;
  };

  const checkQueryLimit = async (forceRefresh: boolean = false): Promise<LimitCheckResult> => {
    console.log('=== CHECK QUERY LIMIT START ===');
    console.log('🔍 Force refresh:', forceRefresh);
    console.log('🔍 Initial check complete:', initialCheckComplete);
    console.log('🔍 Is loading:', isLoading);
    console.log('🔍 User/session present:', !!user, !!session);

    if (!user || !session) {
      console.log('❌ No user or session for limit check');
      const result = { 
        canProceed: false, 
        reason: 'no_auth', 
        message: 'Debes iniciar sesión para usar el chat' 
      };
      setInitialCheckComplete(true);
      return result;
    }

    // Control de concurrencia
    if (isChecking && !forceRefresh) {
      console.log('⚠️ Limit check already in progress, using cached result');
      return lastCheckResult || {
        canProceed: false,
        reason: 'checking_in_progress',
        message: 'Verificando límites, espera un momento...',
      };
    }

    // Verificar caché
    const now = Date.now();
    if (!forceRefresh && lastCheckResult && (now - lastCheckTime) < CACHE_DURATION) {
      console.log('📋 Using cached limit check result');
      return lastCheckResult;
    }

    console.log('🔍 Performing fresh limit check...');
    isChecking = true;
    setIsLoading(true);
    
    try {
      const data = await fetchFromManageUsage('check_limit');
      console.log('✅ manage-usage responded with:', data);

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

      console.log('✅ Limit check completed successfully:', result);
      return result;
      
    } catch (err: any) {
      console.error('❌ Error in checkQueryLimit:', err);
      
      const errorResult: LimitCheckResult = {
        canProceed: false,
        reason: 'error',
        message: err.message || 'Error desconocido'
      };
      
      lastCheckResult = null;
      return errorResult;
      
    } finally {
      isChecking = false;
      setIsLoading(false);
      setInitialCheckComplete(true);
      console.log('✅ initialCheckComplete set to true');
    }
  };

  const logQuery = async (queryText: string, responseLength: number) => {
    if (!user || !session) return;
    
    try {
      console.log('📝 Logging query usage...');
      await fetchFromManageUsage('log_query', { queryText, responseLength });
      
      // Invalidar caché después de log
      lastCheckResult = null;
      lastCheckTime = 0;
      
    } catch (err) {
      console.error('❌ Error logging query:', err);
    }
  };

  const loadUsageData = async () => {
    try {
      console.log('📊 Loading initial usage data...');
      const result = await checkQueryLimit(true);
      if (result.usageData) {
        setUsageData(result.usageData);
      }
    } catch (err) {
      console.error('❌ Error loading usage data:', err);
    }
  };

  const waitUntilReady = async (): Promise<void> => {
    console.log('⏳ waitUntilReady called, initialCheckComplete:', initialCheckComplete);
    
    if (initialCheckComplete) {
      console.log('✅ Already ready, returning immediately');
      return;
    }

    console.log('⏳ Waiting for initial check to complete...');
    
    return new Promise((resolve) => {
      const checkReady = () => {
        console.log('🔍 Checking if ready... initialCheckComplete:', initialCheckComplete);
        if (initialCheckComplete) {
          console.log('✅ Ready! Resolving promise');
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      // Timeout después de 10 segundos
      setTimeout(() => {
        console.log('⚠️ waitUntilReady timeout after 10 seconds');
        resolve();
      }, 10000);
      
      checkReady();
    });
  };

  useEffect(() => {
    if (session && user && !initialCheckComplete) {
      console.log('🚀 Initial usage data load triggered...');
      loadUsageData();
    }
  }, [session, user, initialCheckComplete]);

  return {
    usageData,
    isLoading,
    initialCheckComplete,
    checkQueryLimit,
    logQuery,
    loadUsageData,
    waitUntilReady,
  };
};
