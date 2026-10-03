import { MAX_PHOTO_DIMENSION, PHOTO_QUALITY } from "@/domain/photos/photos";
import { createExpoPhotoPreparer } from "@/infrastructure/photos/expoPhotoPreparer";

function fakeSdk(width: number, height: number) {
  const saveAsync = jest.fn(async () => ({ uri: "file:///prepared.jpg", width, height }));
  const resize = jest.fn();
  const sdk = {
    ImageManipulator: {
      manipulate: jest.fn(() => {
        const context: any = {
          resize: (size: unknown) => {
            resize(size);
            return context;
          },
          renderAsync: async () => ({ width, height, saveAsync }),
        };
        return context;
      }),
    },
    SaveFormat: { JPEG: "jpeg" },
  };
  return { sdk: sdk as any, saveAsync, resize };
}

it("always writes a new JPEG instead of passing the original file through", async () => {
  const { sdk, saveAsync } = fakeSdk(1200, 900);

  const prepared = await createExpoPhotoPreparer(sdk).prepare({ uri: "file:///original-with-gps.heic" });

  expect(saveAsync).toHaveBeenCalledWith({ format: "jpeg", compress: PHOTO_QUALITY });
  expect(prepared.uri).toBe("file:///prepared.jpg");
  expect(prepared.uri).not.toContain("original");
});

it("scales a large landscape photo down by its width", async () => {
  const { sdk, resize } = fakeSdk(4032, 3024);

  await createExpoPhotoPreparer(sdk).prepare({ uri: "file:///big.jpg" });

  expect(resize).toHaveBeenCalledWith({ width: MAX_PHOTO_DIMENSION });
});

it("scales a large portrait photo down by its height", async () => {
  const { sdk, resize } = fakeSdk(3024, 4032);

  await createExpoPhotoPreparer(sdk).prepare({ uri: "file:///tall.jpg" });

  expect(resize).toHaveBeenCalledWith({ height: MAX_PHOTO_DIMENSION });
});

it("leaves a small photo's size alone", async () => {
  const { sdk, resize } = fakeSdk(800, 600);

  await createExpoPhotoPreparer(sdk).prepare({ uri: "file:///small.jpg" });

  expect(resize).not.toHaveBeenCalled();
});
