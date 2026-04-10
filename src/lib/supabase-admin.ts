import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase-config";

export function createSupabaseAdminClient() {
  const config = getSupabaseConfig();

  if (!config.url || !config.serviceRoleKey) {
    throw new Error("Supabase admin client is not configured.");
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
