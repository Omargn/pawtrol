import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { FlagTargetType, ModerationAction, ModerationRepository, NewFlag } from "@/domain/moderation/moderation";
import { chatKeys } from "@/hooks/createChatHooks";
import { reportKeys } from "@/hooks/createReportHooks";

export const moderationKeys = {
  all: ["moderation"] as const,
  /** Per user, so signing in as someone else never reuses the answer. */
  role: (userId: string) => ["moderation", "role", userId] as const,
  queue: () => ["moderation", "queue"] as const,
  recent: () => ["moderation", "recent"] as const,
};

/** A status change can hide or restore content anywhere it's shown. */
function refreshContent(queryClient: QueryClient, targetType: FlagTargetType) {
  const keys = {
    report: [reportKeys.all],
    sighting: [["sightings"], reportKeys.all],
    message: [["messages"], chatKeys.all],
  }[targetType];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function createModerationHooks(repository: ModerationRepository) {
  /** Whether to show moderation UI. The server still checks every action. */
  function useIsModerator(userId: string | null) {
    const query = useQuery({
      queryKey: moderationKeys.role(userId ?? "none"),
      queryFn: () => repository.isModerator(),
      enabled: userId !== null,
      staleTime: 5 * 60_000,
    });
    return query.data === true;
  }

  /** Rejects with a WriteError. Content the flag auto-hides disappears from wherever it's cached. */
  function useFlagContent() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (flag: NewFlag) => repository.flag(flag),
      onSuccess: (_, flag) => refreshContent(queryClient, flag.targetType),
    });
  }

  function useModerationQueue(enabled: boolean) {
    return useQuery({ queryKey: moderationKeys.queue(), queryFn: () => repository.listQueue(), enabled });
  }

  function useRecentlyModerated(enabled: boolean) {
    return useQuery({ queryKey: moderationKeys.recent(), queryFn: () => repository.listRecentlyModerated(), enabled });
  }

  /** Rejects with a WriteError. */
  function useModerate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (input: { targetType: FlagTargetType; targetId: string; action: ModerationAction; reason: string | null }) =>
        repository.moderate(input.targetType, input.targetId, input.action, input.reason),
      onSuccess: (_, input) =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: moderationKeys.queue() }),
          queryClient.invalidateQueries({ queryKey: moderationKeys.recent() }),
          refreshContent(queryClient, input.targetType),
        ]),
    });
  }

  return { useIsModerator, useFlagContent, useModerationQueue, useRecentlyModerated, useModerate };
}
