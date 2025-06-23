
// Utilidad para diagnóstico detallado de red
export const networkDiagnostics = {
  // Test básico de conectividad a Supabase
  async testSupabaseConnection() {
    console.log('🔍 TESTING SUPABASE CONNECTION...');
    const supabaseUrl = 'https://dozaqjmdoblwqnuprxnq.supabase.co';
    
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvemFxam1kb2Jsd3FudXByeG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTU5ODAsImV4cCI6MjA2NTQzMTk4MH0.dOvT-HqqkUBXZTq3aRoiQZT5Je8Ejn-Bzy6ZqeTR_gk'
        }
      });
      console.log('✅ Supabase REST endpoint reachable:', response.status);
      return true;
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      return false;
    }
  },

  // Test directo de la función edge
  async testDirectFunctionCall(accessToken: string, planName: string = 'Profesional') {
    console.log('🔍 TESTING DIRECT FUNCTION CALL...');
    const functionUrl = 'https://dozaqjmdoblwqnuprxnq.supabase.co/functions/v1/create-checkout';
    
    try {
      console.log('Making direct fetch to:', functionUrl);
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvemFxam1kb2Jsd3FudXByeG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NTU5ODAsImV4cCI6MjA2NTQzMTk4MH0.dOvT-HqqkUBXZTq3aRoiQZT5Je8Ejn-Bzy6ZqeTR_gk'
        },
        body: JSON.stringify({ planName })
      });

      console.log('Direct fetch response status:', response.status);
      console.log('Direct fetch response headers:', [...response.headers.entries()]);
      
      const responseText = await response.text();
      console.log('Direct fetch response body:', responseText);
      
      return { success: response.ok, status: response.status, body: responseText };
    } catch (error) {
      console.error('❌ Direct function call failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Monitor network requests
  monitorNetworkRequests() {
    console.log('🔍 MONITORING NETWORK REQUESTS...');
    
    // Override fetch to monitor all requests
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const [url, options] = args;
      console.log('🌐 FETCH REQUEST:', {
        url: url.toString(),
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body
      });
      
      try {
        const response = await originalFetch.apply(this, args);
        console.log('🌐 FETCH RESPONSE:', {
          url: url.toString(),
          status: response.status,
          statusText: response.statusText,
          headers: [...response.headers.entries()]
        });
        return response;
      } catch (error) {
        console.error('🌐 FETCH ERROR:', {
          url: url.toString(),
          error: error.message
        });
        throw error;
      }
    };
  }
};
