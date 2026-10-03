import { supabase } from "@/composition/supabaseClient";
import { withDemoReports } from "@/infrastructure/dev/withDemoReports";
import { createSupabaseReportRepository } from "@/infrastructure/supabase/supabaseReportRepository";

const repository = createSupabaseReportRepository(supabase);

/**
 * Production wiring. In development, EXPO_PUBLIC_DEMO_DATA=1 adds demo
 * reports around Mexico City (see .env.example); release builds ignore it.
 */
export const reportRepository =
  __DEV__ && process.env.EXPO_PUBLIC_DEMO_DATA === "1" ? withDemoReports(repository) : repository;
