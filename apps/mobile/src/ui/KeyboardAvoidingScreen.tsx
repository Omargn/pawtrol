import { useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from "react";
import { KeyboardAvoidingView, View } from "react-native";

/**
 * A screen whose bottom (a composer, a form's button) stays above the
 * keyboard. KeyboardAvoidingView measures itself relative to its parent, so
 * under a navigation header it lifts the content short by the header's
 * height; this measures where the screen actually starts in the window and
 * passes that as the offset, whatever header sits above it.
 */
export function KeyboardAvoidingScreen({
  children,
  style,
}: {
  children: ReactNode;
  style?: ComponentProps<typeof View>["style"];
}) {
  const frame = useRef<ComponentRef<typeof View>>(null);
  const [top, setTop] = useState(0);

  return (
    <View ref={frame} style={{ flex: 1 }} onLayout={() => frame.current?.measureInWindow((_x, y) => setTop(y))}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={top} style={[{ flex: 1 }, style]}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}
