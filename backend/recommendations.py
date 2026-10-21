from fastapi import APIRouter, BackgroundTasks, Depends
from openai import OpenAI
from utils.sql_helper import SQLHelper
import os, json
from sqlalchemy import text
from utils.auth_dependency import get_current_user

from utils.db import engine

db_helper = SQLHelper()
router = APIRouter(prefix="/recommendations", tags=["recommendations"])
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@router.get("/get_recommendations")
async def getRecommendations(userID: str):
    
    query_text = db_helper.load_query("sql_queries/get_recommendation_data.sql")
    
    try:
        with engine.connect() as connection:
            result = connection.execute(text(query_text), {"userID": userID})
            rows = [dict(row._mapping) for row in result]
    except Exception as e:
        print(f"Database Error: {e}")
        return []

    if not rows:
        return[]
    
    user = {
        "name": rows[0]["name"],
        "preferences": rows[0].get("preferences",[])
    }

    events = []
    for r in rows:
        events.append({
            "id": r["event_id"],
            "title": r["title"],
            "description": r["description"]
        })

    prompt = f"""
    You are recommending events to a college student.

    User:
    {user}

    Events:
    {events}

    Return ONLY a JSON object with a single key "ids" containing an array of the top 3 event IDs.
    Example: {{"ids": [1, 5, 8]}}
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.choices[0].message.content
        parsed = json.loads(content)
        ids = parsed.get("ids", [])

    except Exception as e:
        print(f"Recommendation Error: {e}") 
        ids = []

    if not ids:
        return events[:3]

    recommended = [e for e in events if str(e["id"]) in [str(i) for i in ids]]

    return recommended[:3]

    



@router.post("/review_recommendation")
async def reviewRecommendation(userID: str, eventID: str, rating: int, current_user: dict = Depends(get_current_user)):
    pass

