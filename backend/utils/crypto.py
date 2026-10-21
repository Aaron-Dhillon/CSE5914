from Crypto.Hash import BLAKE2b
from Crypto.Cipher import Salsa20
from Crypto.Random import get_random_bytes

class CryptoManager:

    def encrypt_data(self, data: str, key: bytes) -> bytes:
        #encodes the dat using Salsa20
        cipher = Salsa20.new(key=key)
        return cipher.nonce + cipher.encrypt(data.encode())

    def decrypt_data(self, encoded_data: bytes, key: bytes) -> str:
        #decodes data using Salsa20
        nonce = encoded_data[:8]
        ciphertext = encoded_data[8:]
        
        cipher = Salsa20.new(key=key, nonce=nonce)
        return cipher.decrypt(ciphertext)

    def hash_data(self, data: bytes) -> str:
        #Generate a BLAKE2b hash
        hasher = BLAKE2b.new(digest_bits=256)
        hasher.update(data)
        return hasher.hexdigest()

    def verify_hash(self, data: bytes, expected_hash: str) -> bool:
        #verifies the data is the correct hash
        return self.hash_data(data) == expected_hash

    def generate_key(self, length: int = 32) -> bytes:
        #Generates a random key for Salsa20
        return get_random_bytes(length)

# --- Passwords ---------------------------------------------------------------
# Salted scrypt (memory-hard, stdlib). Stored as "s1$<salt>$<hash>" in base64, 52 chars,
# short enough for the old 64-char BLAKE2b column values it replaces.
import hashlib
import hmac
import base64 as _b64
import secrets

_SCRYPT = dict(n=2**14, r=8, p=1, dklen=24)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(12)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return "s1$" + _b64.b64encode(salt).decode() + "$" + _b64.b64encode(digest).decode()


def verify_password(password: str, stored: str) -> tuple[bool, bool]:
    """Returns (ok, needs_upgrade). Accepts old unsalted BLAKE2b hashes so they can be upgraded."""
    if stored.startswith("s1$"):
        _, salt, digest = stored.split("$")
        check = hashlib.scrypt(password.encode(), salt=_b64.b64decode(salt), **_SCRYPT)
        return hmac.compare_digest(check, _b64.b64decode(digest)), False
    legacy = CryptoManager().hash_data(password.encode())
    return hmac.compare_digest(legacy, stored), True


_h = hash_password("correct horse")
assert len(_h) == 52 and verify_password("correct horse", _h) == (True, False)
assert verify_password("wrong", _h) == (False, False)
assert verify_password("pw", CryptoManager().hash_data(b"pw")) == (True, True)
del _h
