import { createExpoLocationService, POSITION_TIMEOUT_MS } from "@/infrastructure/location/expoLocationService";

function fakeSdk(position: Promise<{ coords: { latitude: number; longitude: number } }>) {
  return {
    getForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied", canAskAgain: false })),
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted", canAskAgain: true })),
    getCurrentPositionAsync: jest.fn(() => position),
    Accuracy: { Balanced: 3 },
  } as any;
}

it("maps the OS permission answer", async () => {
  const service = createExpoLocationService(fakeSdk(new Promise(() => {})), async () => {});

  await expect(service.getPermission()).resolves.toEqual({ granted: false, canAskAgain: false });
  await expect(service.requestPermission()).resolves.toEqual({ granted: true, canAskAgain: true });
});

it("returns just the coordinates of a fix", async () => {
  const service = createExpoLocationService(
    fakeSdk(Promise.resolve({ coords: { latitude: 19.4, longitude: -99.1, accuracy: 30 } as any })),
    async () => {},
  );

  await expect(service.getCurrentPosition()).resolves.toEqual({ latitude: 19.4, longitude: -99.1 });
});

it("gives up instead of hanging when no fix arrives", async () => {
  jest.useFakeTimers();
  const service = createExpoLocationService(fakeSdk(new Promise(() => {})), async () => {});

  const position = service.getCurrentPosition();
  jest.advanceTimersByTime(POSITION_TIMEOUT_MS);

  await expect(position).rejects.toThrow("timed out");
  jest.useRealTimers();
});
