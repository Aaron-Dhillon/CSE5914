SELECT
    id,
    external_id,
    title,
    description,
    category,
    location_name,
    location_address,
    latitude,
    longitude,
    start_time,
    end_time,
    image_url,
    source,
    source_url,
    website_url
FROM event_options
-- Only upcoming dated events; recurring Google Places rows carry a stale start_time
WHERE start_time >= NOW()
ORDER BY start_time
LIMIT 100;
