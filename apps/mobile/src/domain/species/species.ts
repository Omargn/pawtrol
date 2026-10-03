export type Species = { id: number; slug: string; label: string };

export type SpeciesRepository = {
  /** Every species, in display order. Rejects with the underlying error. */
  listSpecies(): Promise<Species[]>;
};
