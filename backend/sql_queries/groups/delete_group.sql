DELETE FROM groups
WHERE id = :group_id AND created_by = :user_id
RETURNING id, image_url;
