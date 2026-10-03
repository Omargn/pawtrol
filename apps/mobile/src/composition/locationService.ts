import { Linking } from "react-native";
import * as Location from "expo-location";
import { createExpoLocationService } from "@/infrastructure/location/expoLocationService";

export const locationService = createExpoLocationService(Location, () => Linking.openSettings());
