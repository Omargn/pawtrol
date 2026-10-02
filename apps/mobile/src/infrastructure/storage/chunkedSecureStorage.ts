/** The async key-value shape supabase-js persists its session through. */
export type SessionStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** The subset of expo-secure-store this needs, injected so tests run without the native module. */
export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/**
 * SecureStore warns past 2048 bytes per value (and older Android keystores reject it), while a
 * Supabase session with provider metadata routinely runs 3–4 KB. 500 characters stays under the
 * limit even when every character takes the 4 bytes UTF-8 allows.
 */
export const CHUNK_SIZE = 500;

const countKey = (key: string) => `${key}.count`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

/**
 * Keeps the session in the device keychain/keystore instead of AsyncStorage, split across as many
 * SecureStore entries as it needs. See docs/adr/0003-session-storage.md for why not the
 * encrypt-into-AsyncStorage alternative.
 *
 * The count is written last and removed first, so a write interrupted halfway (app killed) leaves
 * no count and reads as "no session" — the user signs in again — rather than stitching old and new
 * chunks into a token that looks valid.
 */
export function createChunkedSecureStorage(store: SecureStoreLike): SessionStorage {
  async function readCount(key: string) {
    const raw = await store.getItemAsync(countKey(key));
    const count = raw === null ? NaN : Number(raw);
    return Number.isInteger(count) && count > 0 ? count : null;
  }

  async function removeChunks(key: string, from: number, to: number) {
    for (let index = from; index < to; index++) {
      await store.deleteItemAsync(chunkKey(key, index));
    }
  }

  return {
    async getItem(key) {
      const count = await readCount(key);
      if (count === null) return null;

      const chunks: string[] = [];
      for (let index = 0; index < count; index++) {
        const chunk = await store.getItemAsync(chunkKey(key, index));
        if (chunk === null) return null;
        chunks.push(chunk);
      }
      return chunks.join("");
    },

    async setItem(key, value) {
      const previousCount = (await readCount(key)) ?? 0;
      await store.deleteItemAsync(countKey(key));

      const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
      for (let index = 0; index < count; index++) {
        await store.setItemAsync(chunkKey(key, index), value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
      }
      await store.setItemAsync(countKey(key), String(count));

      await removeChunks(key, count, previousCount);
    },

    async removeItem(key) {
      const count = (await readCount(key)) ?? 0;
      await store.deleteItemAsync(countKey(key));
      await removeChunks(key, 0, count);
    },
  };
}
