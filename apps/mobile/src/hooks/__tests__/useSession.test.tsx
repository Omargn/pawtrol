import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createAuthSessionHooks } from "@/hooks/createAuthSessionHooks";
import { createInMemoryAuthGateway, makeAuthSession } from "@/test-utils/inMemoryAuthGateway";

// The hook is built on an in-memory AuthGateway: no Supabase and no module mocks.
function setup(options?: Parameters<typeof createInMemoryAuthGateway>[0]) {
  const auth = createInMemoryAuthGateway(options);
  const { useSession } = createAuthSessionHooks(auth.gateway);
  return { ...auth, useSession };
}

afterEach(() => {
  jest.restoreAllMocks();
});

it("starts loading, then reports there's no session", async () => {
  const { useSession, gateway } = setup();
  let finishLoading: (session: null) => void = () => {};
  jest.spyOn(gateway, "getSession").mockReturnValue(new Promise((resolve) => (finishLoading = resolve)));

  const { result } = await renderHook(() => useSession());
  expect(result.current.loading).toBe(true);
  expect(result.current.session).toBeNull();

  await act(async () => finishLoading(null));
  expect(result.current.loading).toBe(false);
  expect(result.current.session).toBeNull();
});

it("stops loading, with no session, when the session can't be read", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  const { useSession, gateway } = setup();
  const failure = new Error("storage unavailable");
  jest.spyOn(gateway, "getSession").mockRejectedValue(failure);

  const { result } = await renderHook(() => useSession());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.session).toBeNull();
  expect(console.error).toHaveBeenCalledWith("Loading the session failed:", failure);
});

describe("INITIAL_SESSION, which supabase-js sends every new listener", () => {
  it("settles on the stored session when getSession() answers first and the event repeats it", async () => {
    const session = makeAuthSession({ id: "user-9" });
    const { useSession } = setup({ session });

    const { result } = await renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBe(session);
  });

  it("settles on no session when nobody is signed in", async () => {
    const { useSession } = setup();

    const { result } = await renderHook(() => useSession());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it("takes the event's session, and ignores a stale getSession() that resolves after it", async () => {
    const session = makeAuthSession({ id: "user-9" });
    const { useSession, gateway } = setup({ session });
    let finishLoading: (session: null) => void = () => {};
    jest.spyOn(gateway, "getSession").mockReturnValue(new Promise((resolve) => (finishLoading = resolve)));

    const { result } = await renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).toBe(session));
    expect(result.current.loading).toBe(true);

    await act(async () => finishLoading(null));

    expect(result.current.session).toBe(session);
    expect(result.current.loading).toBe(false);
  });

  it("does not deliver the event to a listener that already unsubscribed", async () => {
    const { gateway, listenerCount } = setup({ session: makeAuthSession() });
    const listener = jest.fn();

    gateway.onSessionChange(listener)();
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
    expect(listenerCount()).toBe(0);
  });
});

it("keeps a sign-in that happens while the stored session is still loading", async () => {
  const { useSession, gateway } = setup();
  let finishLoading: (session: null) => void = () => {};
  jest.spyOn(gateway, "getSession").mockReturnValue(new Promise((resolve) => (finishLoading = resolve)));
  const { result } = await renderHook(() => useSession());

  await act(async () => {
    await gateway.signInWithPassword("a@b.com", "pw");
  });
  await act(async () => finishLoading(null));

  expect(result.current.session?.user.email).toBe("a@b.com");
  expect(result.current.loading).toBe(false);
});

it("reports the stored session once loaded", async () => {
  const session = makeAuthSession({ id: "user-9" });
  const { useSession } = setup({ session });

  const { result } = await renderHook(() => useSession());

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.session).toBe(session);
});

it("follows sign-in and sign-out as they happen", async () => {
  const { useSession, gateway } = setup();
  const { result } = await renderHook(() => useSession());
  await waitFor(() => expect(result.current.loading).toBe(false));

  await act(async () => {
    await gateway.signInWithPassword("a@b.com", "pw");
  });
  expect(result.current.session?.user.email).toBe("a@b.com");

  await act(async () => {
    await gateway.signOut();
  });
  expect(result.current.session).toBeNull();
});

describe("a session delivered again", () => {
  // Counts every render of a consumer, the way profile.tsx and BookSessionButton.tsx would re-render.
  async function renderCountingSession<T>(useSession: () => T) {
    const counter = { renders: 0 };
    const rendered = await renderHook(() => {
      counter.renders++;
      return useSession();
    });
    return { ...rendered, counter };
  }

  it("does not re-render consumers when nothing they can see changed", async () => {
    const { useSession, gateway } = setup();
    const { result, counter } = await renderCountingSession(useSession);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await gateway.signInWithPassword("a@b.com", "pw");
    });
    const settled = counter.renders;
    const signedIn = result.current.session;

    // A second sign-in builds a new AuthSession object carrying the same fields, which is the
    // shape of the TOKEN_REFRESHED event supabase-js emits about once an hour.
    await act(async () => {
      await gateway.signInWithPassword("a@b.com", "pw");
    });

    expect(counter.renders).toBe(settled);
    expect(result.current.session).toBe(signedIn);
  });

  it("re-renders once when a field the app shows did change", async () => {
    const { useSession, gateway } = setup();
    const { result, counter } = await renderCountingSession(useSession);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await gateway.signInWithPassword("a@b.com", "pw");
    });
    const settled = counter.renders;

    await act(async () => {
      await gateway.saveProfileName({ fullName: "Ada", givenName: "Ada", familyName: null });
    });

    expect(counter.renders).toBe(settled + 1);
    expect(result.current.session?.user.fullName).toBe("Ada");
  });
});

it("stops listening on unmount", async () => {
  const { useSession, listenerCount } = setup();
  const { unmount } = await renderHook(() => useSession());
  expect(listenerCount()).toBe(1);

  await unmount();

  expect(listenerCount()).toBe(0);
});
