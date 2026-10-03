export type Coordinates = { latitude: number; longitude: number };

export type LocationPermission = {
  granted: boolean;
  /** Whether the OS will still show its prompt; false means only Settings can grant it now. */
  canAskAgain: boolean;
};

/**
 * The device's position. Never sent to the server: it only centers the map,
 * and the server is asked for the visible area instead.
 */
export type LocationService = {
  getPermission(): Promise<LocationPermission>;
  requestPermission(): Promise<LocationPermission>;
  /** One fresh fix. Rejects when there's no permission or no fix within the timeout. */
  getCurrentPosition(): Promise<Coordinates>;
  openSettings(): Promise<void>;
};
