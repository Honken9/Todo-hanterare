import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Saknar Supabase-konfiguration. Sätt VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY i .env.local',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type ProfileRow = {
  id: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
};

export type TodoRow = {
  id: string;
  text: string;
  done: boolean;
  created_at: string;
  created_by: string | null;
  assigned_to: string | null;
  due_at: string | null;
  archived_at: string | null;
};
