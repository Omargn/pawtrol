import { speciesRepository } from "@/composition/speciesRepository";
import { createSpeciesHooks } from "@/hooks/createSpeciesHooks";

export const { useSpecies } = createSpeciesHooks(speciesRepository);
