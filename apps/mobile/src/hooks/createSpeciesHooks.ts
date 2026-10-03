import { useQuery } from "@tanstack/react-query";
import type { SpeciesRepository } from "@/domain/species/species";

export function createSpeciesHooks(repository: SpeciesRepository) {
  /** Reference data that changes with a migration, not at runtime: fetched once per session. */
  function useSpecies() {
    return useQuery({
      queryKey: ["species"],
      queryFn: () => repository.listSpecies(),
      staleTime: Infinity,
    });
  }

  return { useSpecies };
}
