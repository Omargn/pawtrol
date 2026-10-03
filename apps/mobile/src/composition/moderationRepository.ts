import { supabase } from "@/composition/supabaseClient";
import { createSupabaseModerationRepository } from "@/infrastructure/supabase/supabaseModerationRepository";

export const moderationRepository = createSupabaseModerationRepository(supabase);
