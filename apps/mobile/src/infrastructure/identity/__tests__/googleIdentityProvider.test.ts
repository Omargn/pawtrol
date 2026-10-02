import { createGoogleIdentityProvider } from "@/infrastructure/identity/googleIdentityProvider";

type GoogleSdk = Parameters<typeof createGoogleIdentityProvider>[0];

const hasPlayServices = jest.fn();
const signIn = jest.fn();
const sdk = {
  GoogleSignin: { hasPlayServices, signIn },
  isErrorWithCode: (error: unknown) => typeof error === "object" && error !== null && "code" in error,
  statusCodes: { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED" },
} as unknown as GoogleSdk;
const provider = createGoogleIdentityProvider(sdk);

afterEach(() => {
  hasPlayServices.mockReset();
  signIn.mockReset();
});

it("checks Play Services, then returns the ID token", async () => {
  signIn.mockResolvedValue({ type: "success", data: { idToken: "google-token" } });

  await expect(provider.requestCredential()).resolves.toEqual({ provider: "google", idToken: "google-token" });
  expect(hasPlayServices).toHaveBeenCalledTimes(1);
  expect(hasPlayServices.mock.invocationCallOrder[0]).toBeLessThan(signIn.mock.invocationCallOrder[0]);
});

it("rejects without signing in when Play Services are unavailable", async () => {
  const error = new Error("no play services");
  hasPlayServices.mockRejectedValue(error);

  await expect(provider.requestCredential()).rejects.toBe(error);
  expect(signIn).not.toHaveBeenCalled();
});

it("resolves null when Google's sheet is dismissed without a result", async () => {
  signIn.mockResolvedValue({ type: "cancelled", data: null });

  await expect(provider.requestCredential()).resolves.toBeNull();
});

it("resolves null when the sign-in is cancelled", async () => {
  signIn.mockRejectedValue({ code: "SIGN_IN_CANCELLED" });

  await expect(provider.requestCredential()).resolves.toBeNull();
});

it("rejects on any other Google failure", async () => {
  const error = { code: "IN_PROGRESS" };
  signIn.mockRejectedValue(error);

  await expect(provider.requestCredential()).rejects.toBe(error);
});

it("rejects when Google returns no ID token", async () => {
  signIn.mockResolvedValue({ type: "success", data: { idToken: null } });

  await expect(provider.requestCredential()).rejects.toThrow("No idToken returned from Google.");
});
