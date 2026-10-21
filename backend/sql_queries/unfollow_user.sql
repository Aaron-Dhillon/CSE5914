DELETE FROM follows
WHERE follower_id = :follower_id
  AND following_id = :following_id;