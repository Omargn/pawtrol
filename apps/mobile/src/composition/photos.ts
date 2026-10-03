import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { createExpoPhotoPicker } from "@/infrastructure/photos/expoPhotoPicker";
import { createExpoPhotoPreparer } from "@/infrastructure/photos/expoPhotoPreparer";

export const photoPicker = createExpoPhotoPicker(ImagePicker);
export const photoPreparer = createExpoPhotoPreparer({ ImageManipulator, SaveFormat });
