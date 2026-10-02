/**
 * Placeholder until the first migration lands (Phase 1). Then this file is
 * generated, never edited by hand:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 *
 * The shape below is the empty schema supabase-js expects, so typed clients
 * compile today without inventing tables.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
