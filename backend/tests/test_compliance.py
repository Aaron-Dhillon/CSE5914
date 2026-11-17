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


class FakeConnection:
    """Records SQL; answers the password lookup and the image query."""
    def __init__(self, log, password_hash):
        self.log, self.password_hash = log, password_hash

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, statement, params=None):
        sql = str(statement)
        self.log.append(sql)
        outer = self

        class Result:
            def mappings(self):
                return self

            def fetchone(self):
                return {"password": outer.password_hash} if "SELECT password" in sql else None

            def scalars(self):
                return self

            def all(self):
                return ["https://example.com/poster.jpg"]

        return Result()


def delete_client(monkeypatch, user_id, password="right-pass"):
    from fastapi.testclient import TestClient
    from main import app
    from accounts import user as account
    from utils.auth_dependency import get_current_user
    from utils.crypto import hash_password

    log = []
    hashed = hash_password("right-pass")

    class FakeEngine:
        def connect(self):
            return FakeConnection(log, hashed)

        begin = connect

    monkeypatch.setattr(account, "engine", FakeEngine())
    monkeypatch.setattr(account, "delete_uploaded_image", lambda url: log.append(f"photo {url}"))
    app.dependency_overrides[get_current_user] = lambda: {"user_id": user_id, "email": "x@osu.edu"}
    try:
        res = TestClient(app).request("DELETE", "/account/delete_account", json={"password": password})
    finally:
        app.dependency_overrides.clear()
    return res, log


def test_delete_account_removes_everything(monkeypatch):
    res, log = delete_client(monkeypatch, "user-1")
    assert res.status_code == 200
    assert log[-2].startswith("DELETE FROM profiles")  # profile last, after everything pointing at it
    assert any("follows" in sql for sql in log) and log[-1] == "photo https://example.com/poster.jpg"


def test_delete_account_needs_the_right_password(monkeypatch):
    res, log = delete_client(monkeypatch, "user-2", password="wrong")
    assert res.status_code == 403  # not 401, which would sign the browser out
    assert not any(sql.startswith("DELETE") for sql in log)


def test_demo_account_cant_be_deleted(monkeypatch):
    from chat import DEMO_USER_ID
    res, log = delete_client(monkeypatch, DEMO_USER_ID)
    assert res.status_code == 403 and log == []
