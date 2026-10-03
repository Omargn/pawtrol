import { supabase } from "@/composition/supabaseClient";
import { createSupabaseMediaStorage } from "@/infrastructure/supabase/supabaseMediaStorage";

export const mediaStorage = createSupabaseMediaStorage(supabase);
