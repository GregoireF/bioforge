import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const dbClient =  createClient<Database>(
    import.meta.env.SUPABASE_URL!,
    import.meta.env.SUPABASE_SECRET_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    }
)