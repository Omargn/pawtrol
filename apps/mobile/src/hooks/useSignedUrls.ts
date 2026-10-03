import { mediaStorage } from "@/composition/mediaStorage";
import { createMediaHooks } from "@/hooks/createMediaHooks";

export const { useSignedUrls } = createMediaHooks(mediaStorage);
