import { InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase.config';

export type SupabaseClientLoader = () => Promise<SupabaseClient>;

export const SUPABASE_CLIENT_LOADER = new InjectionToken<SupabaseClientLoader>(
  'Supabase client loader',
  {
    providedIn: 'root',
    factory: () => {
      let clientPromise: Promise<SupabaseClient> | null = null;
      const canUseBrowserStorage = typeof window !== 'undefined';

      return () => {
        clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
          createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
            auth: {
              autoRefreshToken: canUseBrowserStorage,
              detectSessionInUrl: false,
              persistSession: canUseBrowserStorage,
            },
          }),
        );

        return clientPromise;
      };
    },
  },
);
