import { supabase } from "@/composition/supabaseClient";
import { createSupabaseAuthGateway } from "@/infrastructure/supabase/supabaseAuthGateway";

/** Production wiring: the one place where the auth contract meets the Supabase client. */
export const authGateway = createSupabaseAuthGateway(supabase);
