"""Security checks that need no database. Run from backend/: python -m pytest tests"""
import importlib
import os
import sys

import pytest

os.environ["JWT_SECRET"] = "test-secret-" + "x" * 40
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from utils import rate_limit
from utils.crypto import CryptoManager, hash_password, verify_password
from utils.jwt_helper import create_token

client = TestClient(app)
alice = {"Authorization": "Bearer " + create_token("alice-id", "a@osu.edu")}


@pytest.mark.parametrize("method,path,body", [
    ("put", "/account/profile", {"display_name": "x", "major": "x", "has_car": False, "bio": ""}),
    ("get", "/account/profile?id=bob-id", None),
    ("get", "/preferences", None),
    ("put", "/preferences", {"event_size": "small", "event_distance": 0}),
    ("put", "/preferences/categories", {"category_ids": []}),
    ("post", "/chat/basic", {"history": [{"role": "user", "content": "hi"}]}),
    ("post", "/follow/00000000-0000-0000-0000-000000000000", None),
])
def test_requires_login(method, path, body):
    kwargs = {} if body is None else {"json": body}
    assert client.request(method.upper(), path, **kwargs).status_code == 401


def test_cannot_read_other_users_data():
    assert client.get("/account/profile", params={"id": "bob-id"}, headers=alice).status_code == 403
    assert client.get("/chat/top-recommendations/bob-id", headers=alice).status_code == 403


def test_old_recommendations_api_is_gone():
    assert client.get("/recommendations/get_recommendations", params={"userID": "x"}).status_code == 404


def test_passwords_are_salted_and_old_hashes_upgrade():
    a, b = hash_password("pw"), hash_password("pw")
    assert a != b and a.startswith("s1$")
    assert verify_password("pw", a) == (True, False)
    assert verify_password("nope", a) == (False, False)
    assert verify_password("pw", CryptoManager().hash_data(b"pw")) == (True, True)


def test_rate_limit_blocks_then_clears():
    key = "test:limit"
    for _ in range(3):
        rate_limit.check(key, [(3, 60)], "tries")
        rate_limit.record(key)
    with pytest.raises(HTTPException) as e:
        rate_limit.check(key, [(3, 60)], "tries")
    assert e.value.status_code == 429
    rate_limit.clear(key)
    rate_limit.check(key, [(3, 60)], "tries")


def test_api_refuses_to_start_without_jwt_secret(monkeypatch):
    import utils.jwt_helper as jh
    monkeypatch.setenv("JWT_SECRET", "")
    with pytest.raises(RuntimeError):
        importlib.reload(jh)
    monkeypatch.setenv("JWT_SECRET", os.environ["JWT_SECRET"] or "test-secret-" + "x" * 40)
