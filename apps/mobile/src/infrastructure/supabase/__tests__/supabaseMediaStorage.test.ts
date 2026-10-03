import { SIGNED_URL_TTL_SECONDS } from "@/domain/media/mediaStorage";
import { createSupabaseMediaStorage, PHOTO_BUCKET } from "@/infrastructure/supabase/supabaseMediaStorage";

function setup(result: { data: unknown; error: unknown }) {
  const createSignedUrls = jest.fn(async () => result);
  const from = jest.fn(() => ({ createSignedUrls }));
  return { from, createSignedUrls, storage: createSupabaseMediaStorage({ storage: { from } } as any) };
}

it("signs every path in one request and keys the answer by path", async () => {
  const { from, createSignedUrls, storage } = setup({
    data: [
      { path: "u/a.jpg", signedUrl: "https://signed/a", error: null },
      { path: "u/b.jpg", signedUrl: "https://signed/b", error: null },
    ],
    error: null,
  });

  await expect(storage.signedUrls(["u/a.jpg", "u/b.jpg"])).resolves.toEqual({
    "u/a.jpg": "https://signed/a",
    "u/b.jpg": "https://signed/b",
  });
  expect(from).toHaveBeenCalledWith(PHOTO_BUCKET);
  expect(createSignedUrls).toHaveBeenCalledWith(["u/a.jpg", "u/b.jpg"], SIGNED_URL_TTL_SECONDS);
});

it("leaves out paths the caller can't read instead of failing the batch", async () => {
  const { storage } = setup({
    data: [
      { path: "u/a.jpg", signedUrl: "https://signed/a", error: null },
      { path: "u/hidden.jpg", signedUrl: "", error: "Either the object does not exist or you do not have access to it" },
    ],
    error: null,
  });

  await expect(storage.signedUrls(["u/a.jpg", "u/hidden.jpg"])).resolves.toEqual({ "u/a.jpg": "https://signed/a" });
});

it("makes no request for no paths", async () => {
  const { createSignedUrls, storage } = setup({ data: [], error: null });

  await expect(storage.signedUrls([])).resolves.toEqual({});
  expect(createSignedUrls).not.toHaveBeenCalled();
});
