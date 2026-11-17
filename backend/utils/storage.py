"""Removes a user's uploaded photo from Supabase storage once nothing uses it anymore."""
import os
from sqlalchemy import text
from supabase import create_client
from utils.db import engine

BUCKET = "event-images"  # events and groups both upload here


def uploaded_path(url: str | None) -> str | None:
    """The file's path in our bucket, or None for outside images (e.g. Ticketmaster posters)."""
    prefix = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/storage/v1/object/public/{BUCKET}/"
    if not url or not os.getenv("SUPABASE_URL") or not url.startswith(prefix):
        return None
    path = url[len(prefix):]
    return path if path and "/" not in path and ".." not in path else None


def delete_uploaded_image(url: str | None) -> None:
    """Best effort: a failure is logged, never shown, since the event or group is already gone."""
    path = uploaded_path(url)
    if not path:
        return
    try:
        # image_url comes from the browser, so another event or group may point at the same file
        with engine.connect() as connection:
            in_use = connection.execute(
                text("SELECT 1 FROM events WHERE image_url = :url UNION ALL SELECT 1 FROM groups WHERE image_url = :url LIMIT 1"),
                {"url": url},
            ).first()
        if in_use:
            return
        create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY")).storage.from_(BUCKET).remove([path])
    except Exception as e:  # noqa: BLE001
        print(f"Could not delete uploaded image {path}: {e}")
