import { createAppleIdentityProvider } from "@/infrastructure/identity/appleIdentityProvider";

type AppleSdk = Parameters<typeof createAppleIdentityProvider>[0];

const signInAsync = jest.fn();
const sdk = {
  signInAsync,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
} as unknown as AppleSdk;
const provider = createAppleIdentityProvider(sdk);

afterEach(() => {
  signInAsync.mockReset();
});

it("asks Apple for the user's name and email", async () => {
  signInAsync.mockResolvedValue({ identityToken: "apple-token", fullName: null });

  await provider.requestCredential();

  expect(signInAsync).toHaveBeenCalledWith({ requestedScopes: [0, 1] });
});

it("returns the identity token, without a name when Apple sent none", async () => {
  signInAsync.mockResolvedValue({ identityToken: "apple-token", fullName: null });

  const credential = await provider.requestCredential();

  expect(credential).toEqual({ provider: "apple", idToken: "apple-token" });
  expect(credential).not.toHaveProperty("name");
});

it("joins the name parts Apple sent, skipping empty ones", async () => {
  signInAsync.mockResolvedValue({
    identityToken: "apple-token",
    fullName: { givenName: "Jane", middleName: "", familyName: "Doe" },
  });

  await expect(provider.requestCredential()).resolves.toEqual({
    provider: "apple",
    idToken: "apple-token",
    name: { fullName: "Jane Doe", givenName: "Jane", familyName: "Doe" },
  });
});

it("omits the name when every part is empty", async () => {
  signInAsync.mockResolvedValue({
    identityToken: "apple-token",
    fullName: { givenName: null, middleName: null, familyName: null },
  });

  await expect(provider.requestCredential()).resolves.not.toHaveProperty("name");
});

it("resolves null when the user cancels", async () => {
  signInAsync.mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });

  await expect(provider.requestCredential()).resolves.toBeNull();
});

it("rejects on any other Apple failure", async () => {
  const error = { code: "ERR_REQUEST_FAILED" };
  signInAsync.mockRejectedValue(error);

  await expect(provider.requestCredential()).rejects.toBe(error);
});

it("rejects when Apple returns no identity token", async () => {
  signInAsync.mockResolvedValue({ identityToken: null, fullName: null });

  await expect(provider.requestCredential()).rejects.toThrow("No identityToken returned from Apple.");
});
