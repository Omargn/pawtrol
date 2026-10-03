import { locationService } from "@/composition/locationService";
import { createLocationHooks } from "@/hooks/createLocationHooks";

export const { LocationProvider, useUserLocation } = createLocationHooks(locationService);
