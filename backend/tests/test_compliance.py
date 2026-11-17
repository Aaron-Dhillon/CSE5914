import os
import sys

os.environ.setdefault("JWT_SECRET", "test-secret-" + "x" * 40)
os.environ.setdefault("OPENAI_API_KEY", "test-key")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import chat  # noqa: E402
from utils import storage  # noqa: E402


def test_crisis_reply_skips_the_assistant(monkeypatch):
    from fastapi.testclient import TestClient
    from main import app
    from utils.auth_dependency import get_current_user

    monkeypatch.setattr(chat, "mentions_self_harm", lambda text: True)
    monkeypatch.setattr(chat, "get_supabase", lambda: (_ for _ in ()).throw(AssertionError("assistant ran")))
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "crisis-test-user"}
    try:
        res = TestClient(app).post("/chat/basic", json={"history": [{"role": "user", "content": "x"}]})
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 200 and "988" in res.json()["reply"]


def test_only_our_own_uploads_are_deleted(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    base = "https://abc.supabase.co/storage/v1/object/public/event-images/"
    assert storage.uploaded_path(base + "123_x.jpg") == "123_x.jpg"
    assert storage.uploaded_path("https://s1.ticketm.net/poster.jpg") is None
    assert storage.uploaded_path(base + "../other/secret.jpg") is None
    assert storage.uploaded_path("https://evil.co/storage/v1/object/public/event-images/a.jpg") is None
    assert storage.uploaded_path(None) is None
