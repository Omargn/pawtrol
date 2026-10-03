import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { SpeciesRepository } from "@/domain/species/species";

export function createSupabaseSpeciesRepository(client: SupabaseClient<Database>): SpeciesRepository {
  return {
    async listSpecies() {
      const { data, error } = await client.from("species").select("id, slug, label").order("sort_order");
      if (error) throw error;
      return data;
    },
  };
}
