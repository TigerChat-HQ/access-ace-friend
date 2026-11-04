// Supabase client configuration for independent TIGERCHATS deployments.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// These are public client credentials, not service-role secrets.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://dngilyoyhmgazhuuaxfh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_x5y4C6qof0o696ypXZ_IpA_HH4okt0_';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
