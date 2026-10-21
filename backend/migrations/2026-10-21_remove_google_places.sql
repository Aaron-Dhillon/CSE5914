-- Remove the stale Google Places rows (136 places, photos broken since Google billing was turned off).
-- 12 old "joins" point at them and go too. Backup taken before running:
-- GroupGetter-backups/google_event_options_2026-10-21.json
BEGIN;
DELETE FROM event_option_attendees
WHERE event_option_id IN (SELECT id FROM event_options WHERE source = 'google');
DELETE FROM event_options WHERE source = 'google';
COMMIT;
