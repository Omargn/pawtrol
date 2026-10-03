export type FlagTargetType = "report" | "sighting" | "message";
export type FlagReason = "spam" | "scam" | "abuse" | "wrong_info" | "other";
export type ModerationAction = "hide" | "remove" | "restore";

export const FLAG_REASONS: { value: FlagReason; label: string }[] = [
  { value: "scam", label: "Scam or asking for money" },
  { value: "abuse", label: "Abusive or harassing" },
  { value: "spam", label: "Spam" },
  { value: "wrong_info", label: "Wrong or misleading" },
  { value: "other", label: "Something else" },
];

/** The server rejects longer details. */
export const FLAG_DETAILS_MAX = 500;

export type NewFlag = { targetType: FlagTargetType; targetId: string; reason: FlagReason; details: string | null };

/** One open flag, as the moderation queue reads it. */
export type OpenFlag = {
  targetType: FlagTargetType;
  targetId: string;
  reason: FlagReason;
  details: string | null;
  createdAt: string;
};

/** What a moderator needs to judge a target without opening it. */
export type FlaggedContent = {
  status: string;
  /** The text in question: a report's description, a sighting's note, a message's body. */
  text: string | null;
  /** The report it belongs to, to open it in context. null for messages. */
  reportId: string | null;
};

/** Everything flagged about one target, oldest flag first. */
export type QueueItem = {
  targetType: FlagTargetType;
  targetId: string;
  flags: OpenFlag[];
  /** null when the target no longer exists. */
  content: FlaggedContent | null;
};

/**
 * Flagging and moderating. Reads reject with the underlying error; writes
 * reject with a WriteError.
 */
export type ModerationRepository = {
  /** Flags content the caller can see and didn't write. Flagging twice is a no-op. */
  flag(flag: NewFlag): Promise<void>;
  /** Whether the caller may moderate. Only decides what UI to show: the server checks again. */
  isModerator(): Promise<boolean>;
  /** Targets with open flags, longest-waiting first, capped. Moderators only. */
  listQueue(): Promise<QueueItem[]>;
  /** Applies a moderation action and resolves to the target's new status. */
  moderate(targetType: FlagTargetType, targetId: string, action: ModerationAction, reason: string | null): Promise<string>;
};

/** Groups open flags by target, keeping the order in which targets were first flagged. */
export function groupFlags(flags: OpenFlag[]): Pick<QueueItem, "targetType" | "targetId" | "flags">[] {
  const groups = new Map<string, Pick<QueueItem, "targetType" | "targetId" | "flags">>();
  for (const flag of [...flags].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = `${flag.targetType}:${flag.targetId}`;
    const group = groups.get(key) ?? { targetType: flag.targetType, targetId: flag.targetId, flags: [] };
    group.flags.push(flag);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** What a moderator can do from a target's status: restore only what's hidden or removed. */
export function availableActions(status: string): ModerationAction[] {
  if (status === "removed") return ["restore"];
  if (status === "hidden") return ["restore", "remove"];
  return ["hide", "remove"];
}
