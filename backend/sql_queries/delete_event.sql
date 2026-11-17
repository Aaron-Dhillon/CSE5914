WITH check_owner AS (
    SELECT id FROM events
    WHERE id = :event_id AND created_by = :user_id
),
remove_attendees AS (
    DELETE FROM event_attendees
    WHERE event_id IN (SELECT id FROM check_owner)
)
DELETE FROM events
WHERE id IN (SELECT id FROM check_owner)
RETURNING id, image_url;
