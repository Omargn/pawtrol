import type { PhotoPicker } from "@/domain/photos/photos";

type ImagePickerSdk = Pick<
  typeof import("expo-image-picker"),
  "launchImageLibraryAsync" | "launchCameraAsync" | "requestCameraPermissionsAsync"
>;

export class CameraPermissionError extends Error {
  constructor() {
    super("Camera access is off. You can turn it on in Settings.");
    this.name = "CameraPermissionError";
  }
}

export function createExpoPhotoPicker(sdk: ImagePickerSdk): PhotoPicker {
  return {
    async pickFromLibrary(limit) {
      // The system photo picker runs out of process and needs no library permission.
      const result = await sdk.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: limit > 1,
        selectionLimit: limit,
        quality: 1,
        exif: false,
      });
      if (result.canceled) return null;
      return result.assets.map((asset) => ({ uri: asset.uri }));
    },

    async takePhoto() {
      const permission = await sdk.requestCameraPermissionsAsync();
      if (!permission.granted) throw new CameraPermissionError();
      const result = await sdk.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false });
      if (result.canceled) return null;
      return { uri: result.assets[0].uri };
    },
  };
}
