import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { SIGN_UP_FAILED_MESSAGE } from "@/domain/auth/authGateway";
import { createSupabaseAuthGateway } from "@/infrastructure/supabase/supabaseAuthGateway";

const auth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  signInWithIdToken: jest.fn(),
  updateUser: jest.fn(),
  signOut: jest.fn(),
};
const gateway = createSupabaseAuthGateway({ auth } as unknown as SupabaseClient<Database>);

afterEach(() => {
  Object.values(auth).forEach((mock) => mock.mockReset());
});

const supabaseSession = (userOverrides: Record<string, unknown> = {}) => ({
  access_token: "secret-access",
  refresh_token: "secret-refresh",
  user: {
    id: "user-1",
    email: "a@b.com",
    created_at: "2026-09-01T00:00:00Z",
    user_metadata: { full_name: "Jane Doe", avatar_url: "https://img/a.png" },
    app_metadata: { provider: "google" },
    ...userOverrides,
  },
});

describe("getSession", () => {
  it("maps the session to the app's shape, without tokens or provider metadata", async () => {
    auth.getSession.mockResolvedValue({ data: { session: supabaseSession() } });

    await expect(gateway.getSession()).resolves.toEqual({
      user: {
        id: "user-1",
        email: "a@b.com",
        createdAt: "2026-09-01T00:00:00Z",
        fullName: "Jane Doe",
        avatarUrl: "https://img/a.png",
      },
    });
  });

  it("is null when nobody is signed in", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(gateway.getSession()).resolves.toBeNull();
  });

  it("falls back to the provider's `picture` for the avatar, and to nulls when metadata is missing", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: supabaseSession({ email: undefined, user_metadata: { picture: "https://img/p.png" } }) },
    });
    await expect(gateway.getSession()).resolves.toMatchObject({
      user: { email: null, fullName: null, avatarUrl: "https://img/p.png" },
    });

    auth.getSession.mockResolvedValue({ data: { session: supabaseSession({ user_metadata: undefined }) } });
    await expect(gateway.getSession()).resolves.toMatchObject({ user: { fullName: null, avatarUrl: null } });
  });
});

describe("getSession metadata", () => {
  it("treats blank names and avatars as absent, so callers fall back to the email or the provider's picture", async () => {
    auth.getSession.mockResolvedValue({
      data: {
        session: supabaseSession({ user_metadata: { full_name: "   ", avatar_url: "", picture: "https://img/p.png" } }),
      },
    });

    await expect(gateway.getSession()).resolves.toMatchObject({
      user: { fullName: null, avatarUrl: "https://img/p.png" },
    });
  });

  it("ignores name and avatar values that aren't strings", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: supabaseSession({ user_metadata: { full_name: { first: "Jane" }, avatar_url: 42, picture: "https://img/p.png" } }) },
    });

    await expect(gateway.getSession()).resolves.toMatchObject({
      user: { fullName: null, avatarUrl: "https://img/p.png" },
    });
  });
});

describe("onSessionChange", () => {
  it("maps each auth event's session and stops listening when unsubscribed", () => {
    const unsubscribe = jest.fn();
    let emit: (event: string, session: unknown) => void = () => {};
    auth.onAuthStateChange.mockImplementation((callback) => {
      emit = callback;
      return { data: { subscription: { unsubscribe } } };
    });
    const listener = jest.fn();

    const stop = gateway.onSessionChange(listener);
    emit("SIGNED_IN", supabaseSession());
    emit("SIGNED_OUT", null);

    expect(listener.mock.calls[0][0]).toMatchObject({ user: { id: "user-1" } });
    expect(listener.mock.calls[0][0]).not.toHaveProperty("access_token");
    expect(listener.mock.calls[1][0]).toBeNull();
    expect(unsubscribe).not.toHaveBeenCalled();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("signInWithPassword", () => {
  it("passes the credentials through and reports success", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });

    await expect(gateway.signInWithPassword("a@b.com", "pw")).resolves.toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "pw" });
  });

  it("reports the failure message without exposing the error object", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials", status: 400 } });

    await expect(gateway.signInWithPassword("a@b.com", "pw")).resolves.toEqual({
      ok: false,
      message: "Invalid login credentials",
    });
  });
});

describe("signUp", () => {
  it("sends the full name as user metadata and reports whether a session came back", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await expect(gateway.signUp({ fullName: "Jane", email: "a@b.com", password: "pw" })).resolves.toEqual({
      ok: true,
      hasSession: false,
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pw",
      options: { data: { full_name: "Jane" } },
    });

    auth.signUp.mockResolvedValue({ data: { session: supabaseSession() }, error: null });
    await expect(gateway.signUp({ fullName: "Jane", email: "a@b.com", password: "pw" })).resolves.toEqual({
      ok: true,
      hasSession: true,
    });
  });

  const signUp = () => gateway.signUp({ fullName: "Jane", email: "a@b.com", password: "pw" });

  it("hides that the email is taken behind the generic message, so sign-up can't probe for accounts", async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: "User already registered", code: "user_already_exists", status: 422 },
    });

    await expect(signUp()).resolves.toEqual({ ok: false, message: SIGN_UP_FAILED_MESSAGE });
  });

  it("keeps the message for a failure the user can fix by editing the form", async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: "Password should be at least 6 characters.", code: "weak_password", status: 422 },
    });

    await expect(signUp()).resolves.toEqual({ ok: false, message: "Password should be at least 6 characters." });
  });

  it("falls back to the generic message when the error carries no code", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: { message: "Database error saving new user" } });

    await expect(signUp()).resolves.toEqual({ ok: false, message: SIGN_UP_FAILED_MESSAGE });
  });
});

describe("signInWithIdToken", () => {
  it.each(["apple", "google"] as const)("exchanges a %s ID token", async (provider) => {
    auth.signInWithIdToken.mockResolvedValue({ error: null });

    await expect(gateway.signInWithIdToken(provider, "id-token")).resolves.toBeUndefined();
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider, token: "id-token" });
  });

  it("rejects with the Supabase error when the token is refused", async () => {
    const error = new Error("Invalid token");
    auth.signInWithIdToken.mockResolvedValue({ error });

    await expect(gateway.signInWithIdToken("google", "forged")).rejects.toBe(error);
  });
});

describe("saveProfileName", () => {
  it("stores the name parts as user metadata", async () => {
    auth.updateUser.mockResolvedValue({ error: null });

    await gateway.saveProfileName({ fullName: "Jane Q Doe", givenName: "Jane", familyName: "Doe" });

    expect(auth.updateUser).toHaveBeenCalledWith({
      data: { full_name: "Jane Q Doe", given_name: "Jane", family_name: "Doe" },
    });
  });
});

describe("saveProfileName failure", () => {
  it("rejects with the Supabase error when the name can't be saved", async () => {
    const error = new Error("update failed");
    auth.updateUser.mockResolvedValue({ error });

    await expect(
      gateway.saveProfileName({ fullName: "Jane Doe", givenName: "Jane", familyName: "Doe" }),
    ).rejects.toBe(error);
  });
});

describe("signOut", () => {
  it("signs out of Supabase", async () => {
    auth.signOut.mockResolvedValue({ error: null });

    await expect(gateway.signOut()).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("resolves and logs when revoking the session server-side fails, since the local session is cleared anyway", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("network down");
    auth.signOut.mockResolvedValue({ error });

    await expect(gateway.signOut()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("Server-side sign-out failed:", error);
    consoleError.mockRestore();
  });
});
