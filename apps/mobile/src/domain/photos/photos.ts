/** A photo on the device, before it's been prepared for upload. */
export type LocalPhoto = { uri: string };

/** A photo re-encoded for upload: JPEG, bounded size, no metadata. */
export type PreparedPhoto = { uri: string; width: number; height: number };

export type PhotoPicker = {
  /** Resolves null when the user cancels. Rejects when permission is denied. */
  pickFromLibrary(limit: number): Promise<LocalPhoto[] | null>;
  takePhoto(): Promise<LocalPhoto | null>;
};

/**
 * Re-encodes a photo before it leaves the device. This is what strips EXIF,
 * including the GPS position of where it was taken — a photo of a lost pet is
 * usually taken at home, and the public map deliberately rounds locations to
 * ~100 m. Every upload must go through it.
 */
export type PhotoPreparer = {
  prepare(photo: LocalPhoto): Promise<PreparedPhoto>;
};

/** Longest side in pixels: plenty to recognize a pet, small enough for mobile data. */
export const MAX_PHOTO_DIMENSION = 1600;
export const PHOTO_QUALITY = 0.75;
export const MAX_PHOTOS_PER_REPORT = 5;
