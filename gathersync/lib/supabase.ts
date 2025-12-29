import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zhjwbzcxevcyxydacetx.supabase.co';
const supabaseAnonKey = 'sb_publishable_W0ktWFf35hbgv3L1bvWybg_mKMkeCp_';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
