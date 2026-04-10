export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    puppyImageBucket: process.env.SUPABASE_PUPPY_IMAGE_BUCKET || "puppy-listings"
  };
}

export function isSupabaseAuthConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export function isSupabasePuppyStoreConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.serviceRoleKey && config.puppyImageBucket);
}
