import Ionicons from "@expo/vector-icons/Ionicons";
import { NativeTabs } from "expo-router/native-tabs";
import { useTheme } from "@/ui/useTheme";

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      tintColor={colors.accent}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{ default: { color: colors.textSecondary }, selected: { color: colors.accent } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf="map"
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="map-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="map" />,
          }}
        />
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="post">
        <NativeTabs.Trigger.Icon
          sf="plus.circle"
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="add-circle-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="add-circle" />,
          }}
        />
        <NativeTabs.Trigger.Label>Post</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf="person"
          src={{
            default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="person-outline" />,
            selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name="person" />,
          }}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
