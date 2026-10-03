import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

type IconName = Extract<ComponentProps<typeof SymbolView>["name"], { ios?: unknown }>;

type IconProps = {
  /** SF Symbol on iOS, Material Symbol on Android and web: every icon needs both. */
  name: Required<Pick<IconName, "ios" | "android">>;
  size?: number;
  color: ColorValue;
};

export function Icon({ name, size = 20, color }: IconProps) {
  return <SymbolView name={{ ...name, web: name.android }} size={size} tintColor={color} />;
}
