# Data model

The migrations in `supabase/migrations/` are canonical, and each one's header explains its non-obvious choices. This page is the map.

```
auth.users ─1:1─ profiles ─┬─< pet_reports ─┬─< report_photos
                           │                ├─< sightings
                           │                └─< conversations ─< messages
                           ├─< content_flags ··· (report | sighting | message)
                           └─< moderation_events ··· (report | sighting | message)
species ─< pet_reports
private.user_roles (moderator | admin)
```

## Tables

| Table | Purpose | Client access |
|---|---|---|
| `profiles` | Display name and avatar. Created by a trigger on sign-up. | Read: everyone. Update own `display_name`, `avatar_path`. |
| `species` | Reference list (dog, cat, …). | Read: everyone. |
| `pet_reports` | A lost or found pet. | Read via RLS (below); all columns except `location`. Writes: RPCs only. |
| `report_photos` | Up to 5 photos per report, ordered. | Read with the report. Writes: `create_report`. |
| `sightings` | "Seen here, at this time" on a report. | Read via RLS; all columns except `location`. Writes: `add_sighting`. |
| `conversations` | One per (report, contact). | Read: the two participants. Writes: `start_conversation`. |
| `messages` | Chat messages. | Read/insert: participants. Insert only `id`, `conversation_id`, `body`; `sender_id` is always the caller. |
| `content_flags` | A user's report of abusive content. | Read: own flags; moderators all. Writes: `flag_content`. |
| `moderation_events` | Append-only log of moderation status changes. | Read: moderators. Writes: moderation RPCs only. |
| `private.user_roles` | Who is a moderator or admin. | None; `has_role()` only. |

### Who sees a report

| Status | Public | Author | Moderator |
|---|---|---|---|
| `active` | ✓ (on the map) | ✓ | ✓ |
| `reunited` | ✓ (by link, not on the map) | ✓ | ✓ |
| `expired` | | ✓ | ✓ |
| `hidden` | | ✓ | ✓ |
| `removed` | | ✓ | ✓ |

Photos and sightings follow their report: when it leaves public view, so do they (including the storage files).

### Location privacy

`pet_reports.location` and `sightings.location` hold the exact point and are never granted to an API role. Clients read `public_lng`/`public_lat` (and `location_public`), snapped to a 0.001° grid (~100 m). Map queries filter on the snapped point too, so the exact one can't be found by querying ever-smaller boxes. Because of the column grants, clients must name their columns: `select=*` is refused.

## RPCs

| Function | Who | Notes |
|---|---|---|
| `reports_in_bbox(min_lng, min_lat, max_lng, max_lat, kinds?, species_ids?, max_rows?)` | everyone | Active, unexpired reports in a box, newest first. Max 500 rows. |
| `reports_near(origin_lng, origin_lat, radius_m?, kinds?, species_ids?, max_rows?)` | everyone | Nearest first, radius capped at 50 km, max 200 rows. |
| `create_report(p_client_id, p_kind, p_species_id, p_description, p_last_seen_at, p_lng, p_lat, p_pet_name?, p_color?, p_size?, p_photo_paths?)` | signed in | Idempotent on `p_client_id`. 5 per hour. Photos must be the caller's own uploads, unused. |
| `mark_reunited(p_report_id)` | author | From active or expired. Idempotent. |
| `renew_report(p_report_id)` | author | Active or expired → active for 30 more days. Returns the new expiry. |
| `add_sighting(p_client_id, p_report_id, p_seen_at, p_lng, p_lat, p_note?, p_photo_path?)` | signed in | Active reports only. Idempotent. 20 per hour. |
| `start_conversation(p_report_id)` | signed in, not the author | Active reports only. Returns the existing one if any. 10 new per hour. |
| `flag_content(p_target_type, p_target_id, p_reason, p_details?)` | signed in, not the author | 3 open flags hide the target. Repeats are no-ops. |
| `moderate(p_target_type, p_target_id, p_action, p_reason?)` | moderators | `hide`, `remove`, `restore`. Resolves open flags; logs the change. Returns the new status. |
| `has_role(required_role)` | signed in | For showing moderation UI. RLS still decides. |

Messages are inserted directly (`insert into messages (id, conversation_id, body)`), capped at 30 per minute per sender. The client generates `id` once per message and reuses it on retries, so a resend fails on the primary key (`23505`) instead of duplicating; the app reads that as "already sent".

### Errors

RPCs raise a stable message key; the app maps it to its own copy.

| Message | SQLSTATE | Meaning |
|---|---|---|
| `not_authenticated` | `28000` | No signed-in user. |
| `not_allowed` | `42501` | Signed in, but not permitted (not the author, not a moderator, wrong state). |
| `not_found` | `P0002` | The target doesn't exist or isn't visible to the caller. |
| `invalid_input` | `22023` | A value failed validation; `detail` may name the field (`location`, `photo`). |
| `rate_limited` | `P0001` | Too many recent writes. |

Column constraints raise their own codes (`23514` check, `23503` foreign key, `23505` unique), and a missing grant or a failed RLS check raises `42501`.

## Background jobs

| Job | Schedule | What |
|---|---|---|
| `expire-pet-reports` (pg_cron) | hourly at :07 | Active reports past `expires_at` → `expired`. |

## Realtime

Only `messages` is published. `pet_reports` is deliberately not: changes stream from the WAL with the whole row, including the exact location.
