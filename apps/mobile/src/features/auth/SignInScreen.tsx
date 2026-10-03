import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, type TextInputInstance } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { TextField } from "@/ui/TextField";
import { radii, spacing, typography } from "@/ui/theme";
import { useTheme } from "@/ui/useTheme";

type Mode = "login" | "signup";

export function SignInScreen() {
  const { colors, scheme } = useTheme();
  const auth = useAuth();
  const { apple: appleEnabled, google: googleEnabled } = auth.availableProviders;
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);

  const canSubmit =
    email.trim().length > 0 && password.length >= 8 && (mode === "login" || name.trim().length > 0) && !busy;

  async function run(action: () => Promise<boolean>) {
    setBusy(true);
    try {
      if (await action()) router.back();
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!canSubmit) return;
    if (mode === "login") {
      await run(() => auth.signInWithEmail(email.trim(), password));
      return;
    }
    setBusy(true);
    try {
      const result = await auth.signUpWithEmail(name.trim(), email.trim(), password);
      if (!result.ok) return;
      if (result.needsConfirmation) {
        setMode("login");
        setNotice("Check your email for a confirmation link, then log in here.");
      } else {
        router.back();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        You need an account to post, add sightings and message owners. Your email is never shown to anyone.
      </Text>

      <View style={styles.modes}>
        <Chip label="Log in" selected={mode === "login"} onPress={() => setMode("login")} />
        <Chip label="Create account" selected={mode === "signup"} onPress={() => setMode("signup")} />
      </View>

      {notice ? (
        <Text selectable style={[typography.body, styles.notice, { backgroundColor: colors.surfaceMuted, color: colors.text }]}>
          {notice}
        </Text>
      ) : null}

      {mode === "signup" ? (
        <TextField
          label="Display name"
          hint="Shown on your reports and in chats."
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          maxLength={50}
        />
      ) : null}
      <TextField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        hint={mode === "signup" ? "At least 8 characters." : undefined}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        textContentType={mode === "signup" ? "newPassword" : "password"}
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button label={mode === "login" ? "Log in" : "Create account"} onPress={submit} disabled={!canSubmit} busy={busy} />

      {appleEnabled || googleEnabled ? (
        <View style={styles.providers}>
          <Text style={[typography.caption, styles.or, { color: colors.textSecondary }]}>or</Text>
          {appleEnabled ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                scheme === "dark"
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={radii.pill}
              style={styles.appleButton}
              onPress={() => run(auth.signInWithApple)}
            />
          ) : null}
          {googleEnabled ? (
            <Button label="Continue with Google" variant="secondary" onPress={() => run(auth.signInWithGoogle)} disabled={busy} />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  modes: { flexDirection: "row", gap: spacing.sm },
  notice: { padding: spacing.md, borderRadius: radii.md, overflow: "hidden" },
  providers: { gap: spacing.md },
  or: { textAlign: "center" },
  appleButton: { height: 50 },
});
