import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AuthSession } from "@/domain/auth/authGateway";
import { createSupabaseAuthGateway } from "@/infrastructure/supabase/supabaseAuthGateway";

// Pins what the contract relies on from the real supabase-js client: no module mocks, just an injected
// fetch and storage, so a library change in how sign-out behaves fails here instead of in the app.
const STORAGE_KEY = "sb-localhost-auth-token";

const storedSession = {
  access_token: "access",
  refresh_token: "refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "user-1", email: "a@b.com", created_at: "2026-09-01T00:00:00Z", user_metadata: {}, app_metadata: {} },
};

function setup(logoutResponse: () => Response | Promise<Response>, { signedIn = true } = {}) {
  const store = new Map<string, string>(signedIn ? [[STORAGE_KEY, JSON.stringify(storedSession)]] : []);
  const storage = {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => void store.set(key, value),
    removeItem: async (key: string) => void store.delete(key),
  };
  const client = createClient<Database>("http://localhost:54321", "anon-key", {
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => logoutResponse() },
  });
  return { gateway: createSupabaseAuthGateway(client), client, store };
}

// useSession relies on this: the listener hears the current session right after subscribing, with no change needed.
describe("a new listener", () => {
  const firstAnnouncement = (gateway: ReturnType<typeof setup>["gateway"]) =>
    new Promise<AuthSession | null>((resolve) => {
      const stop = gateway.onSessionChange((session) => {
        stop();
        resolve(session);
      });
    });

  it("is told the stored session", async () => {
    const { gateway } = setup(() => new Response(null, { status: 204 }));

    await expect(firstAnnouncement(gateway)).resolves.toMatchObject({ user: { id: "user-1" } });
  });

  it("gets an INITIAL_SESSION event carrying the stored session, which is what useSession leans on", async () => {
    const { client } = setup(() => new Response(null, { status: 204 }));

    const initial = await new Promise<{ id?: string } | null>((resolve) => {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event !== "INITIAL_SESSION") return;
        data.subscription.unsubscribe();
        resolve(session?.user ?? null);
      });
    });

    expect(initial).toMatchObject({ id: "user-1" });
  });

  it("is told there is none when nobody is signed in (INITIAL_SESSION with no session)", async () => {
    const { gateway } = setup(() => new Response(null, { status: 204 }), { signedIn: false });

    await expect(firstAnnouncement(gateway)).resolves.toBeNull();
  });
});

it("signs out locally, announcing it, and still resolves when the server can't revoke the session", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const { gateway, store } = setup(() => new Response(JSON.stringify({ message: "boom" }), { status: 500 }));
  const heard: (AuthSession | null)[] = [];
  const stop = gateway.onSessionChange((session) => heard.push(session));
  await expect(gateway.getSession()).resolves.toMatchObject({ user: { id: "user-1" } });

  await expect(gateway.signOut()).resolves.toBeUndefined();

  expect(store.has(STORAGE_KEY)).toBe(false);
  await expect(gateway.getSession()).resolves.toBeNull();
  expect(heard.at(-1)).toBeNull();
  expect(consoleError).toHaveBeenCalledWith("Server-side sign-out failed:", expect.anything());
  stop();
  consoleError.mockRestore();
});

it("signs out locally without logging anything when the server revokes it", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const { gateway, store } = setup(() => new Response(null, { status: 204 }));

  await gateway.signOut();

  expect(store.has(STORAGE_KEY)).toBe(false);
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});
