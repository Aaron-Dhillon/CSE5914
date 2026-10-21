import os
import math
import json
import requests
from dotenv import load_dotenv
from colleges import get_college

load_dotenv()

TM_KEY = os.getenv("TICKETMASTER_API_KEY")

# Slugs match the categories table names (lowercased, non-alphanumerics -> "_")
def map_category(classification: dict) -> str:
    segment   = (classification.get("segment") or {}).get("name")
    genre     = (classification.get("genre") or {}).get("name")
    sub_genre = (classification.get("subGenre") or {}).get("name")
    if segment == "Music":
        return "nightlife_djs" if genre in ("Dance/Electronic", "Other", "Undefined", None) else "concerts"
    if segment == "Sports":
        return "sports"
    if segment == "Arts & Theatre":
        if genre == "Theatre" and sub_genre == "Musical":
            return "musicals"
        if genre in ("Theatre", "Dance", "Classical", "Children's Theatre", "Miscellaneous Theatre", "Opera"):
            return "plays_dance"
        return "comedy_shows"
    if segment == "Miscellaneous" and genre in ("Family", "Ice Shows", "Holiday"):
        return "family_holiday"
    return "other"


def haversine_miles(lat1, lon1, lat2, lon2):
    R = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def fetch_all_events(college_key="ohio_state", radius=30):
    college = get_college(college_key)
    all_events, page = [], 0
    while True:
        resp = requests.get(
            "https://app.ticketmaster.com/discovery/v2/events.json",
            params={
                "apikey":  TM_KEY,
                "latlong": f"{college['lat']},{college['lng']}",
                "radius":  radius,
                "unit":    "miles",
                "size":    200,
                "page":    page,
                "sort":    "date,asc",
            }
        )
        resp.raise_for_status()
        data = resp.json()
        events = data.get("_embedded", {}).get("events", [])
        if not events:
            break
        all_events.extend(events)
        total_pages = data.get("page", {}).get("totalPages", 1)
        page += 1
        if page >= min(total_pages, 5):
            break
    return all_events


def map_to_schema(raw: dict, college: dict) -> dict:
    venue      = (raw.get("_embedded") or {}).get("venues", [{}])[0]
    location   = venue.get("location") or {}
    address    = venue.get("address") or {}
    city_info  = venue.get("city") or {}
    state_info = venue.get("state") or {}
    images     = raw.get("images") or []
    image_url  = max(images, key=lambda i: i.get("width", 0)).get("url") if images else None
    start      = raw.get("dates", {}).get("start", {})
    end        = raw.get("dates", {}).get("end", {})
    prices     = raw.get("priceRanges") or []
    price      = prices[0] if prices else {}

    full_address = ", ".join(filter(None, [
        address.get("line1"),
        city_info.get("name"),
        state_info.get("stateCode"),
    ]))

    lat = float(location["latitude"]) if location.get("latitude") else None
    lng = float(location["longitude"]) if location.get("longitude") else None
    distance = haversine_miles(college["lat"], college["lng"], lat, lng) if lat and lng else None

    category = map_category((raw.get("classifications") or [{}])[0])

    # Price info
    min_price = price.get("min")
    max_price = price.get("max")
    price_level = None
    if min_price is not None:
        if min_price == 0:       price_level = 0
        elif min_price <= 25:    price_level = 1
        elif min_price <= 75:    price_level = 2
        elif min_price <= 150:   price_level = 3
        else:                    price_level = 4

    popularity = None

    return {
        "source":               "ticketmaster",
        "external_id":          raw["id"],
        "title":                raw.get("name"),
        "description":          raw.get("info") or raw.get("pleaseNote"),
        "category":             category,
        "location_name":        venue.get("name"),
        "location_address":     full_address or None,
        "latitude":             lat,
        "longitude":            lng,
        "distance_from_campus": distance,
        "is_recurring":         False,
        "start_time":           start.get("dateTime"),
        "end_time":             end.get("dateTime"),
        "opening_hours":        None,
        "min_price":            min_price,
        "max_price":            max_price,
        "price_level":          price_level,
        "is_free":              min_price == 0 if min_price is not None else False,
        "google_rating":        None,
        "google_review_count":  None,
        "popularity_score":     popularity,
        "image_url":            image_url,
        "source_url":           raw.get("url"),
        "website_url":          raw.get("url"),
        "walkable":             distance is not None and distance <= 2.0,
    }


def sync_ticketmaster_events(engine, college_key="ohio_state", radius=30):
    college = get_college(college_key)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    query_path = os.path.join(base_dir, "..", "sql_queries", "insert_event_options.sql")
    with open(query_path, 'r') as f:
        QUERY = f.read()

    events = fetch_all_events(college_key, radius)

    success = 0
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        for raw in events:
            try:
                params = map_to_schema(raw, college)
                cursor.execute(QUERY, params)
                raw_conn.commit()  # per row, so one bad event's rollback doesn't discard the rest
                success += 1
            except Exception as e:
                raw_conn.rollback()
    finally:
        raw_conn.close()
    return success

