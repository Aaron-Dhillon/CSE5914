import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from utils.sql_helper import SQLHelper
from utils.auth_dependency import get_current_user
from dotenv import load_dotenv
import os

load_dotenv('.env')

from utils.db import engine

router = APIRouter(prefix="/follow", tags=["follow"])

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def resolve_user_id(ref: str) -> str:
    """Profiles are addressed by user id. Old links used display names (not unique), so those still
    resolve, but only when exactly one person has that name."""
    if _UUID.match(ref):
        return ref
    with engine.connect() as connection:
        rows = connection.execute(text("SELECT id FROM profiles WHERE display_name = :name LIMIT 2"), {"name": ref}).fetchall()
    if len(rows) != 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return str(rows[0][0])


@router.get("/{user_ref}/publicProfile")
async def get_public_profile(user_ref: str):
    user_id = resolve_user_id(user_ref)
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/get_user_pubProfile.sql")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load query")

    try:
        with engine.connect() as connection:
            result = connection.execute(query, { 'user_id': user_id })
            row = result.mappings().fetchone()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {
        'id': str(row.get('id')),
        'display_name': row.get('display_name'),
        'followers': row.get('followers') or 0,
        'following': row.get('following') or 0,
        'bio': row.get('bio'),
        'major': row.get('major'),
        'graduation_year': row.get('graduation_year'),
        'has_car': row.get('has_car'),
        'verified': row.get('verified'),
        'interests': row.get('interests') or [],
    }


@router.get("/{user_ref}/isFollowing")
async def is_following(user_ref: str, current_user: dict = Depends(get_current_user)):
    user_id = resolve_user_id(user_ref)
    try:
        with engine.connect() as connection:
            result = connection.execute(text("""
                SELECT 1 FROM follows
                WHERE follower_id = :follower_id
                AND following_id = :following_id
            """), {
                'follower_id': current_user["user_id"],
                'following_id': user_id
            })
            row = result.fetchone()
    except Exception as e:
        print(f"IS_FOLLOWING ERROR: {type(e).__name__}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return {"following": row is not None}


@router.get("/{user_id}/followers")
async def get_followers(user_id: str):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/get_followers.sql")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load query")

    try:
        with engine.connect() as connection:
            result = connection.execute(query, { 'user_id': user_id })
            followers = [row['display_name'] for row in result.mappings().fetchall()]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    return [{"display_name": name} for name in followers]

@router.get("/{user_id}/following")
async def get_following(user_id: str):
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/get_following.sql")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load query")

    try:
        with engine.connect() as connection:
            result = connection.execute(query, { 'user_id': user_id })
            following = [row['display_name'] for row in result.mappings().fetchall()]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    return [{"display_name": name} for name in following]


@router.delete("/{user_ref}")
async def unfollow_user(user_ref: str, current_user: dict = Depends(get_current_user)):
    user_id = resolve_user_id(user_ref)
    sql_helper = SQLHelper()
    try:
        with engine.connect() as connection:
            query = sql_helper.load_query("sql_queries/unfollow_user.sql")
            connection.execute(query, {
                'follower_id': current_user["user_id"],
                'following_id': user_id
            })
            connection.commit()
    except Exception as e:
        print(f"UNFOLLOW ERROR: {type(e).__name__}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    return {"message": "Unfollowed"}

@router.post("/{user_ref}")
async def follow_user(user_ref: str, current_user: dict = Depends(get_current_user)):
    user_id = resolve_user_id(user_ref)
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't follow yourself")
    sql_helper = SQLHelper()
    try:
        query = sql_helper.load_query("sql_queries/follow_user.sql")
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to load query")

    try:
        with engine.connect() as connection:
            connection.execute(query, {
                'follower_id': current_user["user_id"],
                'following_id': user_id
            })
            connection.commit()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Database error: {str(e)}")

    return {"message": "Following"}