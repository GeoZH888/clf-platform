import { createClient } from '@supabase/supabase-js';

// THE canonical Supabase client. Every other file MUST import `supabase`
// from this module — do not call createClient() elsewhere. Multiple clients
// against the same URL produce "Multiple GoTrueClient instances" warnings
// and cause session mismatches (one client signs in, another doesn't see it).

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://yqcojudvvjntaajnrilr.supabase.co';

// Anon key is public by design (RLS-protected). See netlify.toml.
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxY29qdWR2dmpudGFham5yaWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDkxNzQsImV4cCI6MjA5MDkyNTE3NH0.pJuxsTRieYTnZtEysOLcPfUZ9Map0z74o2lKtc8uGAk';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Expose for DevTools debugging. Some legacy auth flows used to set this in
// AuthContext; keeping it here so the affordance survives the consolidation.
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
