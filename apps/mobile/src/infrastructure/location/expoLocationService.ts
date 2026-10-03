import type { Coordinates, LocationService } from "@/domain/location/locationService";

type ExpoLocation = Pick<
  typeof import("expo-location"),
  "getForegroundPermissionsAsync" | "requestForegroundPermissionsAsync" | "getCurrentPositionAsync" | "Accuracy"
>;

/** expo-location has no timeout of its own; indoors a fix can stall indefinitely. */
export const POSITION_TIMEOUT_MS = 6000;

export function createExpoLocationService(sdk: ExpoLocation, openSettings: () => Promise<void>): LocationService {
  const toPermission = ({ status, canAskAgain }: { status: string; canAskAgain: boolean }) => ({
    granted: status === "granted",
    canAskAgain,
  });

  return {
    async getPermission() {
      return toPermission(await sdk.getForegroundPermissionsAsync());
    },

    async requestPermission() {
      return toPermission(await sdk.requestForegroundPermissionsAsync());
    },

    async getCurrentPosition(): Promise<Coordinates> {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Location fetch timed out")), POSITION_TIMEOUT_MS);
      });
      try {
        // Balanced is a few hundred meters at worst, plenty to center a map, and much faster indoors than High.
        const { coords } = await Promise.race([
          sdk.getCurrentPositionAsync({ accuracy: sdk.Accuracy.Balanced }),
          timeout,
        ]);
        return { latitude: coords.latitude, longitude: coords.longitude };
      } finally {
        clearTimeout(timer);
      }
    },

    openSettings,
  };
}
