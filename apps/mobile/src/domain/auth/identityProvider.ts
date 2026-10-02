import type { ProfileName } from "@/domain/auth/authGateway";

export type IdentityCredential = {
  provider: "apple" | "google";
  idToken: string;
  /** Only Apple reports a name, and only on first authorization. */
  name?: ProfileName;
};

/** A third-party sign-in (Apple, Google) that yields an ID token for the AuthGateway to exchange. */
export type IdentityProvider = {
  /** Runs the provider's own sign-in. Resolves null when the user cancels; rejects on any other failure. */
  requestCredential(): Promise<IdentityCredential | null>;
};
