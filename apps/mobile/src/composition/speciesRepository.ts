import { supabase } from "@/composition/supabaseClient";
import { createSupabaseSpeciesRepository } from "@/infrastructure/supabase/supabaseSpeciesRepository";

export const speciesRepository = createSupabaseSpeciesRepository(supabase);
