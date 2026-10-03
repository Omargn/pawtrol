import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/ui/useTheme";

type PhotoProps = {
  /** Storage path: the cache key, since signed URLs change every time they're re-issued. */
  path: string | null;
  url: string | undefined;
  style: ComponentProps<typeof View>["style"];
  accessibilityLabel: string;
};

/** A report photo, or a quiet placeholder while it signs/loads or when there is none. */
export function Photo({ path, url, style, accessibilityLabel }: PhotoProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: colors.surfaceMuted }, style]}>
      <Ionicons name="paw" size={22} color={colors.border} />
      {path && url ? (
        <Image
          source={{ uri: url, cacheKey: path }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          accessibilityLabel={accessibilityLabel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
});
