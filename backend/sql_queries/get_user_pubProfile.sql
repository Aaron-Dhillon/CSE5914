SELECT
	p.id,
	p.display_name,
	p.bio,
	p.major,
	p.graduation_year,
	p.has_car,
	p.verified,
	COALESCE(json_agg(c.name) FILTER (WHERE c.name IS NOT NULL), '[]') AS interests,
	(SELECT count(*) FROM follows f WHERE f.following_id = p.id) AS followers,
	(SELECT count(*) FROM follows f WHERE f.follower_id = p.id) AS following
FROM profiles p
LEFT JOIN user_preferences_categories upc ON upc.user_id = p.id
LEFT JOIN categories c ON c.id = upc.category_id
WHERE p.display_name = :username
GROUP BY p.id, p.display_name, p.bio, p.major, p.graduation_year, p.has_car, p.verified;