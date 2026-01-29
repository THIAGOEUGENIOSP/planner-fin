// js/supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wufdmmmsimmpujhwxthw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JQnudmx1YpDQn8P-1zZQ1Q_ymzEwxPg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
