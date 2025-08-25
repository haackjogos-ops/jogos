import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auto-advance fila function called');

    // Call the enhanced advance function that handles offline users
    const { data, error } = await supabase.rpc('advance_fila_with_offline_check');

    if (error) {
      console.error('Error calling advance_fila_with_offline_check:', error);
      throw error;
    }

    const result = data && data.length > 0 ? data[0] : null;
    
    console.log('Advance fila result:', {
      activeUser: result?.nome_usuario || 'none',
      remainingSeconds: result?.remaining_seconds || 0,
      wasAdvanced: result?.was_advanced || false
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        activeUser: result?.nome_usuario || null,
        remainingSeconds: result?.remaining_seconds || 0,
        wasAdvanced: result?.was_advanced || false,
        timestamp: new Date().toISOString()
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in auto-advance-fila function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});