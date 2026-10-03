import { useLocalSearchParams } from "expo-router";
import { FlagScreen, isFlagTarget } from "@/features/moderation/FlagScreen";
import { ScreenMessage } from "@/ui/ScreenState";

export default function FlagRoute() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  if (!isFlagTarget(type) || !id) return <ScreenMessage title="Nothing to report here" />;
  return <FlagScreen targetType={type} targetId={id} />;
}
