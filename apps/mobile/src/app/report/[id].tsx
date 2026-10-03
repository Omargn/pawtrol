import { useLocalSearchParams } from "expo-router";
import { ReportDetailScreen } from "@/features/reports/ReportDetailScreen";

export default function ReportRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ReportDetailScreen id={id} />;
}
