import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { Coordinates, LocationService } from "@/domain/location/locationService";

export type UserLocationStatus = "loading" | "granted" | "denied" | "error";

type UserLocationState = {
  coords: Coordinates | null;
  status: UserLocationStatus;
  /** Whether the OS will still show its prompt; false means only Settings can grant it now. */
  canAskAgain: boolean;
};

export type UserLocation = UserLocationState & {
  /** Asks again, or opens Settings when the OS won't prompt anymore. */
  refresh: () => void;
  /** A guaranteed-fresh fix for an explicit "center on me", without disturbing `coords`. */
  getFreshPosition: () => Promise<Coordinates>;
};

export function createLocationHooks(service: LocationService) {
  const UserLocationContext = createContext<UserLocation | null>(null);

  /**
   * Owns the one device-location state for the app. Mount once near the root,
   * so screens share a single permission prompt and GPS fix.
   */
  function LocationProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<UserLocationState>({ coords: null, status: "loading", canAskAgain: true });
    const [attempt, setAttempt] = useState(0);
    const statusRef = useRef(state.status);
    useEffect(() => {
      statusRef.current = state.status;
    }, [state.status]);

    const setDenied = useCallback((canAskAgain: boolean) => {
      setState((current) =>
        current.status === "denied" && current.canAskAgain === canAskAgain
          ? current
          : { coords: null, status: "denied", canAskAgain },
      );
    }, []);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        const permission = await service.requestPermission();
        if (cancelled) return;
        if (!permission.granted) {
          setDenied(permission.canAskAgain);
          return;
        }
        try {
          const coords = await service.getCurrentPosition();
          if (!cancelled) setState({ coords, status: "granted", canAskAgain: true });
        } catch {
          if (!cancelled) setState({ coords: null, status: "error", canAskAgain: permission.canAskAgain });
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [attempt, setDenied]);

    // A grant made in the Settings app doesn't come back through our prompt, so
    // re-check (without prompting) whenever the app returns to the foreground.
    useEffect(() => {
      const subscription = AppState.addEventListener("change", (next) => {
        if (next !== "active" || statusRef.current === "loading") return;
        service.getPermission().then((permission) => {
          if (permission.granted) {
            if (statusRef.current !== "granted") setAttempt((n) => n + 1);
          } else {
            setDenied(permission.canAskAgain);
          }
        });
      });
      return () => subscription.remove();
    }, [setDenied]);

    const refresh = useCallback(() => {
      if (state.status !== "granted" && !state.canAskAgain) {
        service.openSettings();
        return;
      }
      setAttempt((n) => n + 1);
    }, [state.status, state.canAskAgain]);

    const getFreshPosition = useCallback(async () => {
      const permission = await service.getPermission();
      if (!permission.granted) {
        setDenied(permission.canAskAgain);
        throw new Error("Location permission not granted");
      }
      return service.getCurrentPosition();
    }, [setDenied]);

    const value = useMemo(() => ({ ...state, refresh, getFreshPosition }), [state, refresh, getFreshPosition]);
    return <UserLocationContext.Provider value={value}>{children}</UserLocationContext.Provider>;
  }

  function useUserLocation() {
    const value = useContext(UserLocationContext);
    if (!value) throw new Error("useUserLocation must be used inside LocationProvider");
    return value;
  }

  return { LocationProvider, useUserLocation };
}
