import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import { radii } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type LocalPhotoThumbProps = {
  uri: string;
  label: string;
  /** Omit to hide the remove button, e.g. while uploading. */
  onRemove?: () => void;
  size?: number;
};

/** A photo picked on the device, not yet posted, with a button to drop it. */
export function LocalPhotoThumb({ uri, label, onRemove, size = 96 }: LocalPhotoThumbProps) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      <Image source={{ uri }} style={[styles.image, { width: size, height: size }]} contentFit="cover" accessibilityLabel={label} />
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label.toLowerCase()}`}
          hitSlop={8}
          style={[styles.remove, { backgroundColor: colors.text }]}
        >
          <Ionicons name="close" size={14} color={colors.background} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { borderRadius: radii.md },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
