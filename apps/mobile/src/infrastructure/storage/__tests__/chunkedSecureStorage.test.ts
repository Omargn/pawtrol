import { CHUNK_SIZE, createChunkedSecureStorage, type SecureStoreLike } from "@/infrastructure/storage/chunkedSecureStorage";

function createFakeSecureStore() {
  const entries = new Map<string, string>();
  const store: SecureStoreLike = {
    getItemAsync: async (key) => entries.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (value.length > CHUNK_SIZE) throw new Error(`value for ${key} is over the chunk size`);
      entries.set(key, value);
    },
    deleteItemAsync: async (key) => {
      entries.delete(key);
    },
  };
  return { store, entries };
}

const KEY = "sb-project-auth-token";

it("reads back a value larger than one SecureStore entry", async () => {
  const { store } = createFakeSecureStore();
  const storage = createChunkedSecureStorage(store);
  const value = "x".repeat(CHUNK_SIZE * 3 + 17);

  await storage.setItem(KEY, value);

  await expect(storage.getItem(KEY)).resolves.toBe(value);
});

it("round-trips an empty string", async () => {
  const storage = createChunkedSecureStorage(createFakeSecureStore().store);

  await storage.setItem(KEY, "");

  await expect(storage.getItem(KEY)).resolves.toBe("");
});

it("answers null for a key that was never written", async () => {
  const storage = createChunkedSecureStorage(createFakeSecureStore().store);

  await expect(storage.getItem(KEY)).resolves.toBeNull();
});

it("drops the extra chunks when a shorter value replaces a longer one", async () => {
  const { store, entries } = createFakeSecureStore();
  const storage = createChunkedSecureStorage(store);

  await storage.setItem(KEY, "a".repeat(CHUNK_SIZE * 4));
  await storage.setItem(KEY, "short");

  await expect(storage.getItem(KEY)).resolves.toBe("short");
  expect([...entries.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.count`]);
});

it("removes every entry it wrote", async () => {
  const { store, entries } = createFakeSecureStore();
  const storage = createChunkedSecureStorage(store);
  await storage.setItem(KEY, "b".repeat(CHUNK_SIZE * 2 + 1));

  await storage.removeItem(KEY);

  expect(entries.size).toBe(0);
  await expect(storage.getItem(KEY)).resolves.toBeNull();
});

it("reads as signed out, not as a stitched token, when a write was interrupted before its count", async () => {
  const { store, entries } = createFakeSecureStore();
  const storage = createChunkedSecureStorage(store);
  await storage.setItem(KEY, "old".repeat(CHUNK_SIZE));

  // The app dies after the count was cleared and one new chunk landed.
  entries.delete(`${KEY}.count`);
  entries.set(`${KEY}.0`, "new");

  await expect(storage.getItem(KEY)).resolves.toBeNull();
});

it("reads as signed out when a chunk the count promises is missing", async () => {
  const { store, entries } = createFakeSecureStore();
  const storage = createChunkedSecureStorage(store);
  await storage.setItem(KEY, "c".repeat(CHUNK_SIZE * 2));

  entries.delete(`${KEY}.1`);

  await expect(storage.getItem(KEY)).resolves.toBeNull();
});
