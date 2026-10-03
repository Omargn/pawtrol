import { moderationRepository } from "@/composition/moderationRepository";
import { createModerationHooks } from "@/hooks/createModerationHooks";

export const { useIsModerator, useFlagContent, useModerationQueue, useRecentlyModerated, useModerate } =
  createModerationHooks(moderationRepository);
