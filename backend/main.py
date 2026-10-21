from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from accounts import api_router
import events
import groups
import preferences
import chat

app = FastAPI(title="CSE5914 Capstone Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(events.router)
app.include_router(groups.router)
app.include_router(preferences.router)
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
