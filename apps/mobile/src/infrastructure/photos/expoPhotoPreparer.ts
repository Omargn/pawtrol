import { MAX_PHOTO_DIMENSION, PHOTO_QUALITY, type PhotoPreparer } from "@/domain/photos/photos";

type ManipulatorSdk = Pick<typeof import("expo-image-manipulator"), "ImageManipulator" | "SaveFormat">;

/**
 * Renders the photo to pixels and writes a brand-new JPEG from them. Only
 * pixel data survives that round trip: EXIF (GPS position, device, time) is
 * not copied into the new file. Large photos are scaled down on the way.
 */
export function createExpoPhotoPreparer(sdk: ManipulatorSdk): PhotoPreparer {
  return {
    async prepare(photo) {
      let image = await sdk.ImageManipulator.manipulate(photo.uri).renderAsync();
      const longest = Math.max(image.width, image.height);
      if (longest > MAX_PHOTO_DIMENSION) {
        const size =
          image.width >= image.height ? { width: MAX_PHOTO_DIMENSION } : { height: MAX_PHOTO_DIMENSION };
        image = await sdk.ImageManipulator.manipulate(image).resize(size).renderAsync();
      }
      const saved = await image.saveAsync({ format: sdk.SaveFormat.JPEG, compress: PHOTO_QUALITY });
      return { uri: saved.uri, width: saved.width, height: saved.height };
    },
  };
}
