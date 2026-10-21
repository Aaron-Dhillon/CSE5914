INSERT INTO follows (follower_id, following_id)
VALUES (:follower_id, :following_id)
ON CONFLICT DO NOTHING;