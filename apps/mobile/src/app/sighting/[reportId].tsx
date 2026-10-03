import { useLocalSearchParams } from "expo-router";
import { AddSightingScreen } from "@/features/sightings/AddSightingScreen";

export default function AddSightingRoute() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  return <AddSightingScreen reportId={reportId} />;
}
