from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from utils.sql_helper import SQLHelper
from utils.db import engine
from utils.auth_dependency import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/preferences", tags=["preferences"])

class CategoryPreferenceUpdate(BaseModel):
    user_id: str | None = None  # ignored: the login token decides whose preferences these are
    category_ids: list[str | int]

class UserPreferencesUpdate(BaseModel):
    user_id: str | None = None  # ignored: the login token decides whose preferences these are
    event_size: str
    event_distance: int
    event_times: list[int] = []

@router.get("/categories")
async def get_category_preferences(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    sql_helper = SQLHelper()

    try:
        query = sql_helper.load_query("sql_queries/get_user_preference_categories.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {
                'user_id': user_id,
            })
            category_ids = [row["category_id"] for row in result.mappings().all()]
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"message": "Database Error"}
        )

    return {"category_ids": category_ids}

@router.get("")
async def get_user_preferences(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    sql_helper = SQLHelper()

    try:
        query = sql_helper.load_query("sql_queries/get_user_preferences.sql")
        create_default_query = sql_helper.load_query("sql_queries/create_default_user_preferences.sql")
        time_query = sql_helper.load_query("sql_queries/get_user_preference_times.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {
                'user_id': user_id,
            })
            preference = result.mappings().first()

            if preference is None:
                connection.execute(create_default_query, {
                    'user_id': user_id,
                })
                connection.commit()

                result = connection.execute(query, {
                    'user_id': user_id,
                })
                preference = result.mappings().first()

            time_result = connection.execute(time_query, {
                'user_id': user_id,
            })
            event_times = [row["event_time"] for row in time_result.mappings().all()]
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"message": "Database Error"}
        )

    return {
        "event_size": preference["event_size"],
        "event_distance": preference["event_distance"],
        "event_times": event_times,
    }

@router.put("/categories")
async def update_category_preferences(payload: CategoryPreferenceUpdate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    sql_helper = SQLHelper()

    try:
        delete_query = sql_helper.load_query("sql_queries/delete_user_preference_categories.sql")
        insert_query = sql_helper.load_query("sql_queries/insert_user_preference_category.sql")

        with engine.connect() as connection:
            connection.execute(delete_query, {
                'user_id': user_id,
            })

            for category_id in payload.category_ids:
                connection.execute(insert_query, {
                    'user_id': user_id,
                    'category_id': category_id,
                })

            connection.commit()
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"message": "Database Error"}
        )

    return {"message": "Category preferences saved."}

@router.put("")
async def update_user_preferences(payload: UserPreferencesUpdate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    sql_helper = SQLHelper()

    try:
        query = sql_helper.load_query("sql_queries/upsert_user_preferences.sql")
        delete_time_query = sql_helper.load_query("sql_queries/delete_user_preference_times.sql")
        insert_time_query = sql_helper.load_query("sql_queries/insert_user_preference_time.sql")

        with engine.connect() as connection:
            connection.execute(query, {
                'user_id': user_id,
                'event_size': payload.event_size,
                'event_distance': payload.event_distance,
            })

            connection.execute(delete_time_query, {
                'user_id': user_id,
            })

            for event_time in payload.event_times:
                connection.execute(insert_time_query, {
                    'user_id': user_id,
                    'event_time': event_time,
                })

            connection.commit()
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"message": "Database Error"}
        )

    return {"message": "Preferences saved."}
