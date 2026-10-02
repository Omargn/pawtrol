import { renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import { SIGN_UP_FAILED_MESSAGE } from "@/domain/auth/authGateway";
import type { IdentityCredential, IdentityProvider } from "@/domain/auth/identityProvider";
import { createAuthHooks } from "@/hooks/createAuthHooks";
import { createInMemoryAuthGateway, makeAuthSession } from "@/test-utils/inMemoryAuthGateway";

// The hooks are built on an in-memory AuthGateway and stub identity providers: no Supabase, no native SDKs, no module mocks.
function stubProvider(result: IdentityCredential | null | Error): IdentityProvider {
  return {
    requestCredential: jest.fn(() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result))),
  };
}

function setup({
  apple = stubProvider(null),
  google = stubProvider(null),
  ...gatewayOptions
}: { apple?: IdentityProvider; google?: IdentityProvider } & Parameters<typeof createInMemoryAuthGateway>[0] = {}) {
  const auth = createInMemoryAuthGateway(gatewayOptions);
  const { useAuth } = createAuthHooks({ gateway: auth.gateway, providers: { apple, google } });
  return { ...auth, useAuth };
}

jest.spyOn(Alert, "alert").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
  jest.clearAllMocks();
});

describe.each([
  ["Apple", "apple", "signInWithApple"],
  ["Google", "google", "signInWithGoogle"],
] as const)("signInWith%s", (label, providerKey, method) => {
  const credential: IdentityCredential = { provider: providerKey, idToken: "id-token" };

  it("exchanges the provider's ID token for a session and returns true", async () => {
    const { useAuth, currentSession } = setup({ [providerKey]: stubProvider(credential) });
    const { result } = await renderHook(() => useAuth());

    await expect(result.current[method]()).resolves.toBe(true);
    expect(currentSession()?.user.id).toBe(`${providerKey}-user`);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  // Cancelling and failing both answer false, so the alert is what tells them apart: the caller
  // keeps the login step open either way, but only a failure is worth reporting.
  it("returns false, without signing in or alerting, when the user cancels the provider's sheet", async () => {
    const { useAuth, currentSession } = setup({ [providerKey]: stubProvider(null) });
    const { result } = await renderHook(() => useAuth());

    await expect(result.current[method]()).resolves.toBe(false);
    expect(currentSession()).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("alerts and returns false when the provider throws", async () => {
    const { useAuth, currentSession } = setup({ [providerKey]: stubProvider(new Error("boom")) });
    const { result } = await renderHook(() => useAuth());

    await expect(result.current[method]()).resolves.toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(`Sign in with ${label} failed`, "Please try again.");
    expect(currentSession()).toBeNull();
  });

  it("alerts and returns false, staying signed out, when the ID token is refused", async () => {
    const { useAuth, currentSession } = setup({
      [providerKey]: stubProvider({ ...credential, idToken: "forged" }),
      refusedIdToken: "forged",
    });
    const { result } = await renderHook(() => useAuth());

    await expect(result.current[method]()).resolves.toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith(`Sign in with ${label} failed`, "Please try again.");
    expect(currentSession()).toBeNull();
  });
});

describe("Apple's first-authorization name", () => {
  const name = { fullName: "Jane Q Doe", givenName: "Jane", familyName: "Doe" };

  it("is saved after the token exchange", async () => {
    const { useAuth, currentSession } = setup({
      apple: stubProvider({ provider: "apple", idToken: "id-token", name }),
    });
    const { result } = await renderHook(() => useAuth());

    await expect(result.current.signInWithApple()).resolves.toBe(true);
    expect(currentSession()?.user.fullName).toBe("Jane Q Doe");
  });

  it("failing to save doesn't fail the sign-in: no alert, still signed in, and it's logged", async () => {
    const { useAuth, gateway, currentSession } = setup({
      apple: stubProvider({ provider: "apple", idToken: "id-token", name }),
    });
    const saveFailure = new Error("update failed");
    jest.spyOn(gateway, "saveProfileName").mockRejectedValue(saveFailure);
    const { result } = await renderHook(() => useAuth());

    await expect(result.current.signInWithApple()).resolves.toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(currentSession()?.user.id).toBe("apple-user");
    expect(console.error).toHaveBeenCalledWith("Saving profile name failed:", saveFailure);
  });

  it("is not saved when the exchange is refused", async () => {
    const { useAuth, gateway } = setup({
      apple: stubProvider({ provider: "apple", idToken: "forged", name }),
      refusedIdToken: "forged",
    });
    const saveProfileName = jest.spyOn(gateway, "saveProfileName");
    const { result } = await renderHook(() => useAuth());

    await expect(result.current.signInWithApple()).resolves.toBe(false);
    expect(saveProfileName).not.toHaveBeenCalled();
  });
});

describe("signInWithEmail", () => {
  it("returns true and signs in when the credentials are right", async () => {
    const { useAuth, currentSession } = setup();
    const { result } = await renderHook(() => useAuth());

    await expect(result.current.signInWithEmail("a@b.com", "pw")).resolves.toBe(true);
    expect(currentSession()?.user.email).toBe("a@b.com");
  });

  it("alerts with the failure message, returns false and stays signed out on wrong credentials", async () => {
    const { useAuth, currentSession } = setup();
    const { result } = await renderHook(() => useAuth());

    await expect(result.current.signInWithEmail("a@b.com", "wrong")).resolves.toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith("Login failed", "Invalid credentials");
    expect(currentSession()).toBeNull();
  });
});

describe("signUpWithEmail", () => {
  it("signals confirmation is needed when the account gets no session", async () => {
    const { useAuth, currentSession } = setup({ requireEmailConfirmation: true });
    const { result } = await renderHook(() => useAuth());

    await expect(result.current.signUpWithEmail("Jane", "new@b.com", "pw")).resolves.toEqual({
      ok: true,
      needsConfirmation: true,
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      "Check your email",
      "We sent you a confirmation link to finish creating your account.",
    );
    expect(currentSession()).toBeNull();
  });

  it("signals no confirmation needed, and signs in, when the account gets a session", async () => {
    const { useAuth, currentSession } = setup();
    const { result } = await renderHook(() => useAuth());

    await expect(result.current.signUpWithEmail("Jane", "new@b.com", "pw")).resolves.toEqual({
      ok: true,
      needsConfirmation: false,
    });
    expect(currentSession()?.user.fullName).toBe("Jane");
  });

  // This project has Confirm email enabled, so GoTrue answers a sign-up for a taken address exactly
  // as it answers a new one — the point of the setting. Pinned against the fake rather than the
  // real client: the obfuscation happens server-side, so an injected fetch would only fix a
  // response we made up ourselves.
  it("cannot be used to tell a taken email from a new one when confirmation is required", async () => {
    const { useAuth, currentSession } = setup({ requireEmailConfirmation: true });
    const { result } = await renderHook(() => useAuth());
    const alert = jest.mocked(Alert.alert);

    const forNewEmail = await result.current.signUpWithEmail("Jane", "new@b.com", "pw");
    const alertsForNewEmail = [...alert.mock.calls];
    expect(currentSession()).toBeNull();
    alert.mockClear();

    // "a@b.com" is already in the fake's account book.
    const forTakenEmail = await result.current.signUpWithEmail("Jane", "a@b.com", "pw");

    expect(forTakenEmail).toEqual(forNewEmail);
    expect(forTakenEmail).toEqual({ ok: true, needsConfirmation: true });
    expect(alert.mock.calls).toEqual(alertsForNewEmail);
    expect(currentSession()).toBeNull();
  });

  it("alerts with the failure message and reports failure", async () => {
    const { useAuth } = setup();
    const { result } = await renderHook(() => useAuth());

    await expect(result.current.signUpWithEmail("Jane", "a@b.com", "pw")).resolves.toEqual({ ok: false });
    expect(Alert.alert).toHaveBeenCalledWith("Sign up failed", SIGN_UP_FAILED_MESSAGE);
  });
});

describe("signOut", () => {
  it("ends the session", async () => {
    const { useAuth, currentSession } = setup({ session: makeAuthSession() });
    const { result } = await renderHook(() => useAuth());

    await result.current.signOut();

    expect(currentSession()).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
