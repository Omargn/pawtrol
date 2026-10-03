import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { LocationPermission, LocationService } from "@/domain/location/locationService";
import { createLocationHooks } from "@/hooks/createLocationHooks";

function fakeService(permission: LocationPermission, position = { latitude: 19.4, longitude: -99.1 }) {
  const service: LocationService & { openSettings: jest.Mock } = {
    getPermission: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => permission),
    getCurrentPosition: jest.fn(async () => position),
    openSettings: jest.fn(async () => {}),
  };
  return service;
}

async function render(service: LocationService) {
  const { LocationProvider, useUserLocation } = createLocationHooks(service);
  const wrapper = ({ children }: { children: ReactNode }) => <LocationProvider>{children}</LocationProvider>;
  return renderHook(() => useUserLocation(), { wrapper });
}

it("asks once and shares the fix", async () => {
  const service = fakeService({ granted: true, canAskAgain: true });

  const { result } = await render(service);

  await waitFor(() => expect(result.current.status).toBe("granted"));
  expect(result.current.coords).toEqual({ latitude: 19.4, longitude: -99.1 });
  expect(service.requestPermission).toHaveBeenCalledTimes(1);
});

it("reports a denial without coordinates", async () => {
  const { result } = await render(fakeService({ granted: false, canAskAgain: true }));

  await waitFor(() => expect(result.current.status).toBe("denied"));
  expect(result.current.coords).toBeNull();
});

it("reports a failed fix as an error, not a denial", async () => {
  const service = fakeService({ granted: true, canAskAgain: true });
  service.getCurrentPosition = jest.fn(async () => {
    throw new Error("timed out");
  });

  const { result } = await render(service);

  await waitFor(() => expect(result.current.status).toBe("error"));
});

it("sends the user to Settings once the OS won't prompt anymore", async () => {
  const service = fakeService({ granted: false, canAskAgain: false });
  const { result } = await render(service);
  await waitFor(() => expect(result.current.status).toBe("denied"));

  await act(async () => result.current.refresh());

  expect(service.openSettings).toHaveBeenCalled();
  expect(service.requestPermission).toHaveBeenCalledTimes(1);
});

it("asks again while the OS still can", async () => {
  const service = fakeService({ granted: false, canAskAgain: true });
  const { result } = await render(service);
  await waitFor(() => expect(result.current.status).toBe("denied"));

  await act(async () => result.current.refresh());

  await waitFor(() => expect(service.requestPermission).toHaveBeenCalledTimes(2));
  expect(service.openSettings).not.toHaveBeenCalled();
});

it("fails a fresh-position request without permission instead of hanging", async () => {
  const { result } = await render(fakeService({ granted: false, canAskAgain: true }));
  await waitFor(() => expect(result.current.status).toBe("denied"));

  await expect(result.current.getFreshPosition()).rejects.toThrow("not granted");
});
