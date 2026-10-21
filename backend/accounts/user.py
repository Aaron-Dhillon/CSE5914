from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from utils.crypto import CryptoManager
from utils.jwt_helper import create_token
from utils.auth_dependency import get_current_user
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
from sqlalchemy import text
from utils.sql_helper import SQLHelper
from utils.db import engine
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
    encrypted_password = crypto_manager.hash_data(data.password.encode())
    email = data.email.strip().lower()

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

@router.post("/login")
async def login(data: Data):
    sql_helper = SQLHelper()
    crypto_manager = CryptoManager()
    user_email = data.email
    hashed_password = crypto_manager.hash_data(data.password.encode())
    
    query = sql_helper.load_query("sql_queries/login.sql")
    with engine.connect() as connection:
        result = connection.execute(query, {
            'email': user_email,
        })
        user = result.mappings().fetchone()

    if user is None:
        print("failed")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"message": "Username or password incorrect"}
        )
    if user['password'] != hashed_password:
        print("wrong password")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"message": "Username or password incorrect"}
        )
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

@router.delete("/delete_account")
async def deleteAccount(data: Data, background_tasks: BackgroundTasks):
    pass


@router.delete("{user_id}")
async def deleteAccount(data: Data, background_tasks: BackgroundTasks):
    pass


@router.post("/{user_id}/modify")
async def modifyAccount(columnID: str, value: str):
    pass
