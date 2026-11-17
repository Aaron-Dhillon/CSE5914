from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from utils.auth_dependency import get_current_user
from utils.sql_helper import SQLHelper
from utils.db import engine
from utils.storage import delete_uploaded_image

router = APIRouter(prefix="/groups", tags=["groups"])
sql = SQLHelper()


class CreateGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    join_policy: str = "open"


class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    join_policy: Optional[str] = None


class UpdateRoleRequest(BaseModel):
    role: str


def _require_role(connection, group_id: str, user_id: str, allowed_roles: list[str]):
    query = sql.load_query("sql_queries/groups/check_membership.sql")
    result = connection.execute(query, {"group_id": group_id, "user_id": user_id})
    row = result.mappings().fetchone()
    if row is None or row["role"] not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action",
        )
    return row["role"]


# --- Group CRUD ---


@router.post("/create")
async def create_group(data: CreateGroupRequest, current_user: dict = Depends(get_current_user)):
    if data.join_policy not in ("open", "approval"):
        raise HTTPException(status_code=400, detail="join_policy must be 'open' or 'approval'")

    query = sql.load_query("sql_queries/groups/create_group.sql")
    try:
        with engine.connect() as connection:
            result = connection.execute(query, {
                "name": data.name,
                "description": data.description,
                "image_url": data.image_url,
                "join_policy": data.join_policy,
                "created_by": current_user["user_id"],
            })
            row = result.mappings().fetchone()
            connection.commit()
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": f"Failed to create group: {e}"})

    return {
        "message": "Group created",
        "group": dict(row) if row else None,
    }


@router.get("/my")
async def my_groups(current_user: dict = Depends(get_current_user)):
    query = sql.load_query("sql_queries/groups/my_groups.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {"user_id": current_user["user_id"]})
        rows = [dict(r) for r in result.mappings().fetchall()]
    return {"groups": rows}


@router.get("")
async def list_groups(
    q: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    query = sql.load_query("sql_queries/groups/list_groups.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {"q": q, "lim": limit, "off": offset})
        rows = [dict(r) for r in result.mappings().fetchall()]
    return {"groups": rows}


@router.get("/featured")
async def featured_groups(
    limit: int = Query(3, ge=1, le=12),
    current_user: dict = Depends(get_current_user),
):
    query = sql.load_query("sql_queries/groups/featured_groups.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {"lim": limit})
        rows = [dict(r) for r in result.mappings().fetchall()]
    return {"groups": rows}


@router.get("/{group_id}")
async def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    query = sql.load_query("sql_queries/groups/get_group.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {"group_id": group_id})
        row = result.mappings().fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"group": dict(row)}


@router.delete("/{group_id}")
async def delete_group(group_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    query = sql.load_query("sql_queries/groups/delete_group.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {
            "group_id": group_id,
            "user_id": current_user["user_id"],
        })
        row = result.mappings().fetchone()
        connection.commit()
    if row is None:
        raise HTTPException(status_code=403, detail="Only the group owner can delete the group")
    background_tasks.add_task(delete_uploaded_image, row["image_url"])
    return {"message": "Group deleted"}


@router.put("/{group_id}")
async def update_group(group_id: str, data: UpdateGroupRequest, current_user: dict = Depends(get_current_user)):
    if data.join_policy and data.join_policy not in ("open", "approval"):
        raise HTTPException(status_code=400, detail="join_policy must be 'open' or 'approval'")

    # Get current group to fill in unchanged fields
    get_query = sql.load_query("sql_queries/groups/get_group.sql")
    with engine.connect() as connection:
        current = connection.execute(get_query, {"group_id": group_id}).mappings().fetchone()
        if current is None:
            raise HTTPException(status_code=404, detail="Group not found")

        query = sql.load_query("sql_queries/groups/update_group.sql")
        result = connection.execute(query, {
            "group_id": group_id,
            "user_id": current_user["user_id"],
            "name": data.name or current["name"],
            "description": data.description if data.description is not None else current["description"],
            "join_policy": data.join_policy or current["join_policy"],
        })
        row = result.mappings().fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(status_code=403, detail="Only the group owner can edit the group")
    return {"message": "Group updated", "group": dict(row)}


# --- Join / Leave ---


@router.post("/{group_id}/join")
async def join_group(group_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]

    with engine.connect() as connection:
        # Check join policy
        policy_query = sql.load_query("sql_queries/groups/get_join_policy.sql")
        policy_result = connection.execute(policy_query, {"group_id": group_id})
        policy_row = policy_result.mappings().fetchone()
        if policy_row is None:
            raise HTTPException(status_code=404, detail="Group not found")

        if policy_row["join_policy"] == "open":
            join_query = sql.load_query("sql_queries/groups/join_group.sql")
            result = connection.execute(join_query, {"group_id": group_id, "user_id": user_id})
            row = result.mappings().fetchone()
            connection.commit()
            if row is None:
                return {"message": "Already a member"}
            return {"message": "Joined group", "membership": dict(row)}
        else:
            # Approval required — create join request
            try:
                req_query = sql.load_query("sql_queries/groups/create_join_request.sql")
                result = connection.execute(req_query, {"group_id": group_id, "user_id": user_id})
                row = result.mappings().fetchone()
                connection.commit()
                return {"message": "Join request submitted", "request": dict(row)}
            except Exception:
                return JSONResponse(
                    status_code=400,
                    content={"message": "You already have a pending request for this group"},
                )


@router.post("/{group_id}/leave")
async def leave_group(group_id: str, current_user: dict = Depends(get_current_user)):
    query = sql.load_query("sql_queries/groups/leave_group.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {
            "group_id": group_id,
            "user_id": current_user["user_id"],
        })
        row = result.mappings().fetchone()
        connection.commit()
    if row is None:
        raise HTTPException(status_code=400, detail="Cannot leave group (you may be the owner or not a member)")
    return {"message": "Left group"}


# --- Members ---


@router.get("/{group_id}/members")
async def list_members(group_id: str, current_user: dict = Depends(get_current_user)):
    query = sql.load_query("sql_queries/groups/list_members.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {"group_id": group_id})
        rows = [dict(r) for r in result.mappings().fetchall()]
    return {"members": rows}


@router.put("/{group_id}/members/{target_user_id}/role")
async def update_member_role(
    group_id: str,
    target_user_id: str,
    data: UpdateRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    if data.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'member'")

    with engine.connect() as connection:
        _require_role(connection, group_id, current_user["user_id"], ["owner", "admin"])
        query = sql.load_query("sql_queries/groups/update_role.sql")
        result = connection.execute(query, {
            "group_id": group_id,
            "target_user_id": target_user_id,
            "new_role": data.role,
        })
        row = result.mappings().fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(status_code=400, detail="Cannot change role (user may be the owner or not a member)")
    return {"message": "Role updated", "membership": dict(row)}


@router.delete("/{group_id}/members/{target_user_id}")
async def kick_member(
    group_id: str,
    target_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    with engine.connect() as connection:
        _require_role(connection, group_id, current_user["user_id"], ["owner", "admin"])
        query = sql.load_query("sql_queries/groups/kick_member.sql")
        result = connection.execute(query, {
            "group_id": group_id,
            "target_user_id": target_user_id,
        })
        row = result.mappings().fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(status_code=400, detail="Cannot remove user (may be owner or not a member)")
    return {"message": "Member removed"}


# --- Join Requests ---


@router.get("/{group_id}/join-requests")
async def list_join_requests(group_id: str, current_user: dict = Depends(get_current_user)):
    with engine.connect() as connection:
        _require_role(connection, group_id, current_user["user_id"], ["owner", "admin"])
        query = sql.load_query("sql_queries/groups/list_join_requests.sql")
        result = connection.execute(query, {"group_id": group_id})
        rows = [dict(r) for r in result.mappings().fetchall()]
    return {"requests": rows}


@router.post("/{group_id}/join-requests/{request_id}/approve")
async def approve_join_request(
    group_id: str,
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    with engine.connect() as connection:
        _require_role(connection, group_id, current_user["user_id"], ["owner", "admin"])

        # Approve the request
        approve_query = sql.load_query("sql_queries/groups/approve_request.sql")
        result = connection.execute(approve_query, {"request_id": request_id, "group_id": group_id})
        row = result.mappings().fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Pending request not found")

        # Add user as member
        join_query = sql.load_query("sql_queries/groups/join_group.sql")
        connection.execute(join_query, {"group_id": group_id, "user_id": str(row["user_id"])})
        connection.commit()

    return {"message": "Request approved, user added to group"}


@router.post("/{group_id}/join-requests/{request_id}/reject")
async def reject_join_request(
    group_id: str,
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    with engine.connect() as connection:
        _require_role(connection, group_id, current_user["user_id"], ["owner", "admin"])
        query = sql.load_query("sql_queries/groups/reject_request.sql")
        result = connection.execute(query, {"request_id": request_id, "group_id": group_id})
        row = result.mappings().fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(status_code=404, detail="Pending request not found")
    return {"message": "Request rejected"}


# --- Group Events ---


@router.post("/{group_id}/events/{event_id}")
async def add_group_event(
    group_id: str,
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    with engine.connect() as connection:
        _require_role(connection, group_id, current_user["user_id"], ["owner", "admin"])
        query = sql.load_query("sql_queries/groups/add_group_event.sql")
        result = connection.execute(query, {"group_id": group_id, "event_id": event_id})
        row = result.mappings().fetchone()
        connection.commit()

    if row is None:
        return {"message": "Event already linked to this group"}
    return {"message": "Event added to group", "link": dict(row)}


@router.delete("/{group_id}/events/{event_id}")
async def remove_group_event(
    group_id: str,
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    with engine.connect() as connection:
        _require_role(connection, group_id, current_user["user_id"], ["owner", "admin"])
        query = sql.load_query("sql_queries/groups/remove_group_event.sql")
        result = connection.execute(query, {"group_id": group_id, "event_id": event_id})
        row = result.mappings().fetchone()
        connection.commit()

    if row is None:
        raise HTTPException(status_code=404, detail="Event not linked to this group")
    return {"message": "Event removed from group"}


@router.get("/{group_id}/events")
async def list_group_events(group_id: str, current_user: dict = Depends(get_current_user)):
    query = sql.load_query("sql_queries/groups/list_group_events.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {"group_id": group_id})
        rows = [dict(r) for r in result.mappings().fetchall()]
    return {"events": rows}
