import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { toWriteError } from "@/domain/errors/writeError";
import {
  groupFlags,
  type FlaggedContent,
  type FlagReason,
  type FlagTargetType,
  type ModeratedItem,
  type ModerationRepository,
  type OpenFlag,
} from "@/domain/moderation/moderation";

/** A day's worth of flags for a small team; older ones wait for the next load. */
const QUEUE_FLAG_LIMIT = 200;
/** How far back "recently moderated" reaches, in log entries. */
const RECENT_EVENT_LIMIT = 100;

export function createSupabaseModerationRepository(client: SupabaseClient<Database>): ModerationRepository {
  /**
   * The flagged targets' status and text: one request per target type, never
   * one per target. RLS lets moderators read every report and sighting, and a
   * message only once it's been flagged.
   */
  async function loadContent(type: FlagTargetType, ids: string[]): Promise<Map<string, FlaggedContent>> {
    const found = new Map<string, FlaggedContent>();
    if (ids.length === 0) return found;
    if (type === "report") {
      const { data, error } = await client.from("pet_reports").select("id, status, description").in("id", ids);
      if (error) throw error;
      for (const row of data) found.set(row.id, { status: row.status, text: row.description, reportId: row.id });
    } else if (type === "sighting") {
      const { data, error } = await client.from("sightings").select("id, status, note, report_id").in("id", ids);
      if (error) throw error;
      for (const row of data) found.set(row.id, { status: row.status, text: row.note, reportId: row.report_id });
    } else {
      const { data, error } = await client.from("messages").select("id, status, body").in("id", ids);
      if (error) throw error;
      for (const row of data) found.set(row.id, { status: row.status, text: row.body, reportId: null });
    }
    return found;
  }

  async function loadAll(targets: { targetType: FlagTargetType; targetId: string }[]) {
    const idsOf = (type: FlagTargetType) => targets.filter((target) => target.targetType === type).map((target) => target.targetId);
    const [report, sighting, message] = await Promise.all([
      loadContent("report", idsOf("report")),
      loadContent("sighting", idsOf("sighting")),
      loadContent("message", idsOf("message")),
    ]);
    return { report, sighting, message };
  }

  return {
    async flag(flag) {
      const { error } = await client.rpc("flag_content", {
        p_target_type: flag.targetType,
        p_target_id: flag.targetId,
        p_reason: flag.reason,
        p_details: flag.details ?? undefined,
      });
      if (error) throw toWriteError(error);
    },

    async isModerator() {
      const { data, error } = await client.rpc("has_role", { required_role: "moderator" });
      if (error) throw error;
      return data;
    },

    async listQueue() {
      const { data, error } = await client
        .from("content_flags")
        .select("target_type, target_id, reason, details, created_at")
        .is("resolved_at", null)
        .order("created_at", { ascending: true })
        .limit(QUEUE_FLAG_LIMIT);
      if (error) throw error;

      const groups = groupFlags(
        data.map(
          (row): OpenFlag => ({
            targetType: row.target_type as FlagTargetType,
            targetId: row.target_id,
            reason: row.reason as FlagReason,
            details: row.details,
            createdAt: row.created_at,
          }),
        ),
      );
      const content = await loadAll(groups);
      return groups.map((group) => ({ ...group, content: content[group.targetType].get(group.targetId) ?? null }));
    },

    async listRecentlyModerated() {
      const { data, error } = await client
        .from("moderation_events")
        .select("target_type, target_id, action, created_at")
        .order("created_at", { ascending: false })
        .limit(RECENT_EVENT_LIMIT);
      if (error) throw error;

      // Newest first, so the first event seen per target is its latest.
      const latest = new Map<string, { targetType: FlagTargetType; targetId: string; action: string; at: string }>();
      for (const row of data) {
        const key = `${row.target_type}:${row.target_id}`;
        if (!latest.has(key)) {
          latest.set(key, { targetType: row.target_type as FlagTargetType, targetId: row.target_id, action: row.action, at: row.created_at });
        }
      }
      const takenDown = [...latest.values()].filter((event) => event.action !== "restored");
      const content = await loadAll(takenDown);
      return takenDown.flatMap((event): ModeratedItem[] => {
        const found = content[event.targetType].get(event.targetId);
        // Restored some other way since (a report renewed, say) or gone: nothing to undo here.
        if (!found || (found.status !== "hidden" && found.status !== "removed")) return [];
        return [{ ...event, action: event.action as ModeratedItem["action"], content: found }];
      });
    },

    async moderate(targetType, targetId, action, reason) {
      const { data, error } = await client.rpc("moderate", {
        p_target_type: targetType,
        p_target_id: targetId,
        p_action: action,
        p_reason: reason ?? undefined,
      });
      if (error) throw toWriteError(error);
      return data;
    },
  };
}
