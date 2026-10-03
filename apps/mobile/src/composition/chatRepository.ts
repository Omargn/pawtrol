import { supabase } from "@/composition/supabaseClient";
import { createSupabaseChatRepository } from "@/infrastructure/supabase/supabaseChatRepository";

export const chatRepository = createSupabaseChatRepository(supabase);
