from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from utils.sql_helper import SQLHelper
from utils.auth_dependency import get_current_user, get_optional_current_user
from dotenv import load_dotenv
from typing import Optional
from datetime import datetime
import os

load_dotenv('.env')

from utils.db import engine

router = APIRouter(prefix="/events", tags=["events"])

@router.get("/categories")
async def get_categories():
    sql_helper = SQLHelper()

    try:
        query = sql_helper.load_query("sql_queries/get_categories.sql")
        with engine.connect() as connection:
            result = connection.execute(query)
            categories = [
                {"id": row["id"], "name": row["name"]}
                for row in result.mappings().all()
            ]
    except Exception:
        return JSONResponse(
            status_code=500,
            content={"message": "Database Error"}
        )

    return {"categories": categories}


def _iso_str(val):
    if val is None:
        return None
    # if it's already a string, return as-is
    if isinstance(val, str):
        return val
    try:
        return val.isoformat()
    except Exception:
        return str(val)

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    image_url: Optional[str] = None
    capacity: Optional[int] = None
    close_date: Optional[datetime] = None
    fee: Optional[int] = 0
    category: Optional[str] = None  # Added category field

@router.post("/create")
async def create(event: EventCreate, current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/create_event.sql")
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Failed to load query"}
        )

    try:
        with engine.connect() as connection:
            result = connection.execute(query, {
                'title': event.title,
                'description': event.description,
                'location_name': event.location_name,
                'location_address': event.location_address,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'image_url': event.image_url,
                'created_by': current_user["user_id"],
                'capacity': event.capacity,
                'close_date': event.close_date,
                'fee': event.fee,
                'category': event.category,  # Added category
            })
            row = result.mappings().fetchone()
            connection.commit()
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": f"Database error: {str(e)}"}
        )

    return {"message": "Event created successfully", "event_id": str(row['id'])}

@router.get("/joined")
async def get_joined_events(current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/get_joined_events.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {'user_id': current_user["user_id"]})
            rows = result.mappings().fetchall()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    items = []
    for r in rows:
        loc_name = r.get('location_name')
        loc_addr = r.get('location_address')
        if loc_name and loc_addr:
            location = f"{loc_name}, {loc_addr}"
        else:
            location = loc_name or loc_addr or None

        items.append({
            'id': str(r.get('id')),
            'title': r.get('title'),
            'date': _iso_str(r.get('start_time')),
            'location': location,
            'description': r.get('description'),
            'thumbnail': r.get('image_url'),
        })

    return items

@router.post("/{event_id}/join")
async def join_event(event_id: str, current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    try:
        with engine.connect() as connection:
            # Try user-created events first
            query = sql_helper.load_query("sql_queries/join_event.sql")
            result = connection.execute(query, {
                'event_id': event_id,
                'user_id': current_user["user_id"],
            })
            row = result.mappings().fetchone()

            if row:
                connection.commit()
                return {"message": "Joined", "currentCapacity": row["current_capacity"]}

            # Fall back to event_options
            query = sql_helper.load_query("sql_queries/join_event_option.sql")
            result = connection.execute(query, {
                'event_id': event_id,
                'user_id': current_user["user_id"],
            })
            row = result.mappings().fetchone()
            if not row:
                connection.rollback()
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot join: event is full, registration is closed, or you already joined")

            # Get updated attendee count
            count_query = sql_helper.load_query("sql_queries/count_event_option_attendees.sql")
            count_result = connection.execute(count_query, {'event_id': event_id})
            count_row = count_result.mappings().fetchone()
            connection.commit()

            return {"message": "Joined", "currentCapacity": count_row["attendee_count"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")


@router.post("/{event_id}/leave")
async def leave_event(event_id: str, current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    try:
        with engine.connect() as connection:
            # Try user-created events first
            query = sql_helper.load_query("sql_queries/leave_event.sql")
            result = connection.execute(query, {
                'event_id': event_id,
                'user_id': current_user["user_id"],
            })
            row = result.mappings().fetchone()

            if row:
                connection.commit()
                return {"message": "Left", "currentCapacity": row["current_capacity"]}

            # Fall back to event_options
            query = sql_helper.load_query("sql_queries/leave_event_option.sql")
            result = connection.execute(query, {
                'event_id': event_id,
                'user_id': current_user["user_id"],
            })
            row = result.mappings().fetchone()
            if not row:
                connection.rollback()
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not currently attending this event")

            # Get updated attendee count
            count_query = sql_helper.load_query("sql_queries/count_event_option_attendees.sql")
            count_result = connection.execute(count_query, {'event_id': event_id})
            count_row = count_result.mappings().fetchone()
            connection.commit()

            return {"message": "Left", "currentCapacity": count_row["attendee_count"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")


@router.get("/{event_id}/attendees")
async def get_attendees(event_id: str):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/get_event_attendees.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {'event_id': event_id})
            rows = result.mappings().fetchall()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    return [
        {
            'userId': str(r['user_id']),
            'displayName': r.get('display_name'),
            'joinedAt': _iso_str(r.get('joined_at')),
        }
        for r in rows
    ]


@router.get("/following")
async def get_following_events(current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    print("user is " + current_user["user_id"])
    try:
        query = sql_helper.load_query("sql_queries/get_following_events.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {'user_id': current_user["user_id"]})
            rows = result.mappings().fetchall()
    except Exception as e:
        print("FOLLOWING EVENTS ERROR:", repr(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    items = []
    for r in rows:
        loc_name = r.get('location_name')
        loc_addr = r.get('location_address')
        location = f"{loc_name}, {loc_addr}" if loc_name and loc_addr else loc_name or loc_addr or None
        items.append({
            'id': str(r.get('id')),
            'title': r.get('title'),
            'date': _iso_str(r.get('start_time')),
            'location': location,
            'description': r.get('description'),
            'thumbnail': r.get('image_url'),
            'category': r.get('category'),
            'source': 'user_created',
        })

    return items

@router.get("/{event_id}")
async def get_event(event_id: str, current_user: Optional[dict] = Depends(get_optional_current_user)):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/select_event_by_id.sql")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load query")

    try:
        with engine.connect() as connection:
            result = connection.execute(query, { 'id': event_id })
            row = result.mappings().fetchone()

            is_attending = False
            event_option_attendee_count = None
            if row:
                is_event_option = row.get('created_by') is None

                if current_user:
                    if is_event_option:
                        att_query = sql_helper.load_query("sql_queries/check_event_option_attendance.sql")
                    else:
                        att_query = sql_helper.load_query("sql_queries/check_attendance.sql")
                    att_result = connection.execute(att_query, {
                        'event_id': event_id,
                        'user_id': current_user["user_id"],
                    })
                    is_attending = att_result.fetchone() is not None

                if is_event_option:
                    count_query = sql_helper.load_query("sql_queries/count_event_option_attendees.sql")
                    count_result = connection.execute(count_query, {'event_id': event_id})
                    count_row = count_result.mappings().fetchone()
                    event_option_attendee_count = count_row["attendee_count"]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Map DB row to frontend shape
    start_time = row.get('start_time')
    date_val = _iso_str(start_time)
    loc_name = row.get('location_name')
    loc_addr = row.get('location_address')
    if loc_name and loc_addr:
        location = f"{loc_name}, {loc_addr}"
    else:
        location = loc_name or loc_addr or None

    return {
        'id': str(row.get('id')),
        'title': row.get('title'),
        'date': date_val,
        'location': location,
        'description': row.get('description'),
        'thumbnail': row.get('image_url'),
        'createdBy': row.get('display_name'),
        'createdById': str(row.get('created_by')) if row.get('created_by') else None,
        'capacity': row.get('capacity'),
        'currentCapacity': event_option_attendee_count if event_option_attendee_count is not None else row.get('current_capacity'),
        'closeDate': _iso_str(row.get('close_date')),
        'isAttending': is_attending,
        'category': row.get('category'),
    }


@router.delete("/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/delete_event.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {
                'event_id': event_id,
                'user_id': current_user["user_id"],
            })
            row = result.mappings().fetchone()
            connection.commit()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    if not row:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Event not found or you are not the creator")

    return {"message": "Event deleted"}

@router.get("/{user_id}/event")
async def get_user_events(user_id: str, current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/get_user_events.sql")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load query")

    try:
        with engine.connect() as connection:
            result = connection.execute(query, {"user_id": current_user["user_id"]})
            rows = result.mappings().fetchall()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    items = []
    for r in rows:
        loc_name = r.get('location_name')
        loc_addr = r.get('location_address') if 'location_address' in r.keys() else None
        if loc_name and loc_addr:
            location = f"{loc_name}, {loc_addr}"
        else:
            location = loc_name or loc_addr or None

        items.append({
            'id': str(r.get('id')),
            'title': r.get('title'),
            'date': _iso_str(r.get('start_time')),
            'location': location,
            'description': r.get('description'),
            'thumbnail': r.get('image_url'),
            'category': r.get('category') if 'category' in r.keys() else None,
        })

    return items

@router.get("")
@router.get("/")
async def list_events(current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    try:
        q1 = sql_helper.load_query("sql_queries/select_event_options.sql")
        q2 = sql_helper.load_query("sql_queries/select_events.sql")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load queries")

    user_id = current_user["user_id"] if current_user else None

    try:
        with engine.connect() as connection:
            r1 = connection.execute(q1, {'current_user_id': user_id}).mappings().fetchall()
            r2 = connection.execute(q2, {'current_user_id': user_id}).mappings().fetchall()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    items = []

    for r in r1:
        loc_name = r.get('location_name')
        loc_addr = r.get('location_address')
        location = f"{loc_name}, {loc_addr}" if loc_name and loc_addr else loc_name or loc_addr or None
        items.append({
            'id': str(r.get('id')),
            'title': r.get('title'),
            'date': _iso_str(r.get('start_time')),
            'location': location,
            'category': r.get('category') if 'category' in r.keys() else None,
            'description': r.get('description'),
            'thumbnail': r.get('image_url'),
            'source': 'event_option',
        })

    for r in r2:
        loc_name = r.get('location_name')
        loc_addr = r.get('location_address')
        location = f"{loc_name}, {loc_addr}" if loc_name and loc_addr else loc_name or loc_addr or None
        items.append({
            'id': str(r.get('id')),
            'title': r.get('title'),
            'date': _iso_str(r.get('start_time')),
            'location': location,
            'category': r.get('category') if 'category' in r.keys() else None,
            'description': r.get('description'),
            'thumbnail': r.get('image_url'),
            'source': 'user_created',  # <-- user-created events
        })

    return items

@router.post("/{event_id}/modify")
async def modify_event(event_id: str, event: EventCreate, current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/update_event.sql")
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Failed to load query"}
        )

    try:
        with engine.connect() as connection:
            result = connection.execute(query, {
                'event_id': event_id,
                'user_id': current_user["user_id"],
                'title': event.title,
                'description': event.description,
                'location_name': event.location_name,
                'location_address': event.location_address,
                'start_time': event.start_time,
                'end_time': event.end_time,
                'image_url': event.image_url,
                'capacity': event.capacity,
                'close_date': event.close_date,
                'fee': event.fee,
                'category': event.category,
            })
            row = result.mappings().fetchone()
            connection.commit()
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": f"Database error: {str(e)}"}
        )

    if not row:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"message": "You are not authorized to modify this event"}
        )

    return {"message": "Event updated successfully", "event_id": str(row['id'])}