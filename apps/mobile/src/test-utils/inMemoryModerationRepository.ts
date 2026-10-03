import { WriteError } from "@/domain/errors/writeError";
import type { ModeratedItem, ModerationRepository, NewFlag, QueueItem } from "@/domain/moderation/moderation";

/** A ModerationRepository over plain arrays. Only a moderator may read the queue or act, as on the server. */
export function createInMemoryModerationRepository({
  moderator = false,
  queue = [] as QueueItem[],
  recent = [] as ModeratedItem[],
}: { moderator?: boolean; queue?: QueueItem[]; recent?: ModeratedItem[] } = {}) {
  const calls = { isModerator: 0, listQueue: 0 };
  const flags: NewFlag[] = [];
  const actions: { targetId: string; action: string }[] = [];

  const repository: ModerationRepository = {
    async flag(flag) {
      flags.push(flag);
    },
    async isModerator() {
      calls.isModerator++;
      return moderator;
    },
    async listQueue() {
      calls.listQueue++;
      if (!moderator) throw new Error("permission denied");
      return queue;
    },
    async listRecentlyModerated() {
      if (!moderator) throw new Error("permission denied");
      return recent;
    },
    async moderate(_targetType, targetId, action) {
      if (!moderator) throw new WriteError("not_allowed");
      actions.push({ targetId, action });
      return action === "hide" ? "hidden" : action === "remove" ? "removed" : "visible";
    },
  };

  return { repository, calls, flags, actions };
}
