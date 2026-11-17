from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.crypto import CryptoManager, hash_password, verify_password
from utils import rate_limit
from utils.jwt_helper import create_token
from utils.auth_dependency import get_current_user
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from sqlalchemy import text
from utils.sql_helper import SQLHelper
from utils.db import engine
from utils.storage import delete_uploaded_image
from chat import DEMO_USER_ID
import base64
import os

load_dotenv('.env')

class Data(BaseModel):
    email: str
    password: str

class ProfileUpdate(BaseModel):
    id: str | None = None  # ignored: the login token decides whose profile this is
    display_name: str
    birth_date: str | None = None
    graduation_year: int | None = None
    major: str
    has_car: bool
    bio: str

class Envs:
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_FROM = os.getenv('MAIL_FROM')
    MAIL_PORT = int(os.getenv('MAIL_PORT'))
    MAIL_SERVER = os.getenv('MAIL_SERVER')
    MAIL_FROM_NAME = os.getenv('MAIL_FROM_NAME')
    SB_url: str = os.getenv("SUPABASE_URL")
    SB_key: str = os.getenv("SUPABASE_KEY")
    debug = os.getenv("DEBUG")
    website_url = os.getenv("WEBSITE_URL")

conf = ConnectionConfig(
    MAIL_USERNAME=Envs.MAIL_USERNAME,
    MAIL_PASSWORD=Envs.MAIL_PASSWORD,
    MAIL_FROM=Envs.MAIL_FROM,
    MAIL_PORT=Envs.MAIL_PORT,
    MAIL_SERVER=Envs.MAIL_SERVER,
    MAIL_FROM_NAME=Envs.MAIL_FROM_NAME,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

router = APIRouter(prefix="/account", tags=["account"])

@router.post("/create_account")
async def create_account(data: Data, background_tasks: BackgroundTasks):
    crypto_manager = CryptoManager()
    sql_helper = SQLHelper()
    email = data.email.strip().lower()
    encrypted_password = hash_password(data.password)

    if not (email.endswith("@osu.edu") or email.endswith("@buckeyemail.osu.edu")):
        return {"message": "Invalid email domain. Please use an osu.edu email."}
    
    try:
        encrypted_email = crypto_manager.encrypt_data(email, base64.urlsafe_b64decode(os.getenv('ENCRYPTION_KEY'))).hex()
        token = crypto_manager.generate_key(length=64)
        token_str = base64.urlsafe_b64encode(token).decode('utf-8')
        encrypted_token = crypto_manager.encrypt_data(token_str, base64.urlsafe_b64decode(os.getenv('ENCRYPTION_KEY'))).hex()
    except:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Crypto Error"}
        )
    try:
        query = sql_helper.load_query("sql_queries/create_account.sql")
    except:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Database connection error"}
        )

    try:
        with engine.connect() as connection:
            result = connection.execute(query, {
                'email': email,
                'password': encrypted_password,
                'token': token_str
            })
            connection.commit()
    except Exception as e:
        if "duplicate key value violates unique constraint" in str(e):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"message": "Invalid Email. Please use a different email address."}
            )

        else:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"message": "Database connection error"}
            )

    verify_link = f"{Envs.website_url}/verify?token={encrypted_token}&user_email={encrypted_email}"

    plain_body = (
        f"Please verify your account by clicking the link below:\n\n"
        f"{verify_link}\n\n"
        f"If you did not create an account, you can ignore this email."
    )

    try:
        message = MessageSchema(
            subject="Verify Your Email Address",
            recipients=[email],
            body=plain_body,
            subtype=MessageType.plain
        )

        fm = FastMail(conf)
        await fm.send_message(message)
        print("EMAIL_SENT_OK")

    except Exception as e:
        print(f"EMAIL_FAILED: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification email")

    return {"message": "Account created. Please check your email to verify your account."}

@router.get("/verify_token")
async def verify_token(token: str, user_email: str):
    try:
        sql_helper = SQLHelper()
        crypto_manager = CryptoManager()
        token = crypto_manager.decrypt_data(bytes.fromhex(token), base64.urlsafe_b64decode(os.getenv('ENCRYPTION_KEY'))).decode()
        user_email = crypto_manager.decrypt_data(bytes.fromhex(user_email), base64.urlsafe_b64decode(os.getenv('ENCRYPTION_KEY'))).decode()
    except:
        return JSONResponse(status_code=500, content={"message": "Crypto Error"})

    try:
        query = sql_helper.load_query("sql_queries/get_user_token.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {'email': user_email.lower()})
            row = result.mappings().fetchone()
        valid_token = row['token']
    except:
        return JSONResponse(status_code=500, content={"message": "Database Error"})

    if token != valid_token:
        return {"message": "Invalid or expired token."}

    query = sql_helper.load_query("sql_queries/validate_user.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {'email': user_email.lower()})
        user = result.mappings().fetchone()
        connection.commit()

    jwt_token = create_token(user_id=str(user['id']), email=user['email'])
    return {
        "token": jwt_token,
        "user": {
            "user_id": str(user['id']),
            "email": user['email'],
        }
    }
    

@router.post("/resend_verification_email")
async def send_verification_email(data: Data, background_tasks: BackgroundTasks):
    crypto_manager = CryptoManager()
    email = email.strip().lower()

    if not (email.endswith("@osu.edu")):
        return {"message": "Invalid email domain. Please use an osu.edu email."}

    token = crypto_manager.generate_key(length=64)
    verify_link = f"{Envs.website_url}/account/verify_token?token={token}&user_email={email}"

    message = MessageSchema(
        subject="Verify Your Account",
        recipients=[email],
        body=f"Please click the following link to verify your account: {verify_link}",
        subtype=MessageType.plain
    )

    fm = FastMail(conf)
    background_tasks.add_task(fm.send_message, message)
    return {"message": "Account created. Please check your email to verify your account."}

# Failed sign-ins allowed per email: (max, window in seconds), shortest window first
LOGIN_LIMITS = [(5, 5 * 60), (10, 60 * 60)]

@router.post("/login")
async def login(data: Data):
    sql_helper = SQLHelper()
    user_email = data.email.strip().lower()
    limit_key = f"login:{user_email}"
    rate_limit.check(limit_key, LOGIN_LIMITS, "failed sign-in attempts")

    query = sql_helper.load_query("sql_queries/login.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {
            'email': user_email,
        })
        user = result.mappings().fetchone()

    ok, needs_upgrade = verify_password(data.password, user['password']) if user else (False, False)
    if not ok:
        rate_limit.record(limit_key)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"message": "Username or password incorrect"}
        )
    rate_limit.clear(limit_key)
    if needs_upgrade:
        # Re-hash old unsalted passwords now that we know the plain text
        with engine.connect() as connection:
            connection.execute(text("UPDATE profiles SET password = :pw WHERE id = :id"), {'pw': hash_password(data.password), 'id': user['id']})
            connection.commit()
    if not user['verified']:
        print("Not Verified")
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"message": "Account not verified please check your email"}
        )
    else:
        token = create_token(user_id=str(user['id']), email=user['email'])
        return {
            "token": token,
            "user": {
                "user_id": str(user['id']),
                "email": user['email'],
            },
        }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user_id": current_user["user_id"], "email": current_user["email"]}
    

@router.get("/profile")
async def get_profile(id: str, current_user: dict = Depends(get_current_user)):
    # Full profile (email, birth date) is private; others use /follow/{username}/publicProfile
    if id != current_user["user_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own full profile")
    sql_helper = SQLHelper()

    try:
        query = sql_helper.load_query("sql_queries/get_user_profile.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {
                'id': id,
            })
            user = result.mappings().fetchone()
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Database Error"}
        )

    if user is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": "Profile not found"}
        )

    return dict(user)

@router.put("/profile")
async def update_profile(profile: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    sql_helper = SQLHelper()

    try:
        query = sql_helper.load_query("sql_queries/update_user_profile.sql")
        with engine.connect() as connection:
            result = connection.execute(query, {
                'id': current_user["user_id"],
                'display_name': profile.display_name,
                'birth_date': profile.birth_date,
                'graduation_year': profile.graduation_year,
                'major': profile.major,
                'has_car': profile.has_car,
                'bio': profile.bio,
            })
            updated_user = result.mappings().fetchone()
            connection.commit()
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"message": "Database Error"}
        )

    if updated_user is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": "Profile not found"}
        )

    return dict(updated_user)

class DeleteAccount(BaseModel):
    password: str


# Everything tied to one user, children before parents, all in one transaction.
DELETE_ACCOUNT_STEPS = [
    # Events they created, and everything attached to them
    "DELETE FROM event_attendees WHERE event_id IN (SELECT id FROM events WHERE created_by = :uid)",
    "DELETE FROM group_events WHERE event_id IN (SELECT id FROM events WHERE created_by = :uid)",
    "DELETE FROM events WHERE created_by = :uid",
    # Groups they own, and everything attached to them
    "DELETE FROM group_events WHERE group_id IN (SELECT id FROM groups WHERE created_by = :uid)",
    "DELETE FROM group_join_requests WHERE group_id IN (SELECT id FROM groups WHERE created_by = :uid)",
    "DELETE FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE created_by = :uid)",
    "DELETE FROM groups WHERE created_by = :uid",
    # Their own rows elsewhere
    "DELETE FROM event_attendees WHERE user_id = :uid",
    "DELETE FROM event_option_attendees WHERE user_id = :uid",
    "DELETE FROM group_members WHERE user_id = :uid",
    "DELETE FROM group_join_requests WHERE user_id = :uid",
    "DELETE FROM follows WHERE follower_id = :uid OR following_id = :uid",
    "DELETE FROM user_preferences_categories WHERE user_id = :uid",
    "DELETE FROM user_preferences_time WHERE user_id = :uid",
    "DELETE FROM user_preferences WHERE user_id = :uid",
    "DELETE FROM profile_tokens WHERE id = :uid",
    "DELETE FROM profiles WHERE id = :uid",
]


@router.delete("/delete_account")
async def delete_account(data: DeleteAccount, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Deletes the signed-in user's account and everything they made. Needs their password again."""
    user_id = current_user["user_id"]
    if user_id == DEMO_USER_ID:
        raise HTTPException(status_code=403, detail="The demo account can't be deleted.")
    limit_key = f"delete:{user_id}"
    rate_limit.check(limit_key, LOGIN_LIMITS, "failed password attempts")

    with engine.connect() as connection:
        user = connection.execute(text("SELECT password FROM profiles WHERE id = :uid"), {"uid": user_id}).mappings().fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    ok, _ = verify_password(data.password, user["password"])
    if not ok:
        rate_limit.record(limit_key)
        raise HTTPException(status_code=403, detail="That password isn't right.")  # 401 would sign them out
    rate_limit.clear(limit_key)

    try:
        with engine.begin() as connection:  # all or nothing: a failed step deletes nothing
            images = connection.execute(
                text("SELECT image_url FROM events WHERE created_by = :uid UNION SELECT image_url FROM groups WHERE created_by = :uid"),
                {"uid": user_id},
            ).scalars().all()
            for step in DELETE_ACCOUNT_STEPS:
                connection.execute(text(step), {"uid": user_id})
    except Exception as e:  # noqa: BLE001
        print(f"Account deletion failed for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Couldn't delete your account. Nothing was removed; try again later.")
    for url in images:
        background_tasks.add_task(delete_uploaded_image, url)
    return {"message": "Account deleted"}


@router.post("/{user_id}/modify")
async def modifyAccount(columnID: str, value: str):
    pass
