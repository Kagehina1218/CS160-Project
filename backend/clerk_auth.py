import os
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Request
from jose import jwt
from jose.exceptions import JWTError

load_dotenv()

CLERK_ISSUER = os.getenv("CLERK_ISSUER", "").rstrip("/")
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL", "").strip()
AUTHORIZED_PARTIES = [
    value.strip()
    for value in os.getenv("CLERK_AUTHORIZED_PARTIES", "").split(",")
    if value.strip()
]


def extract_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise ValueError("Missing Bearer token")
    return auth_header.replace("Bearer ", "", 1).strip()


def _get_jwks() -> dict[str, Any]:
    if not CLERK_JWKS_URL:
        raise ValueError("Missing CLERK_JWKS_URL")

    response = requests.get(CLERK_JWKS_URL, timeout=10)
    response.raise_for_status()
    return response.json()


def verify_clerk_token(token: str) -> dict[str, Any]:
    if not CLERK_ISSUER:
        raise ValueError("Missing CLERK_ISSUER")

    jwks = _get_jwks()

    try:
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={
                "verify_aud": False,
            },
        )
    except JWTError as exc:
        raise ValueError(f"Invalid Clerk token: {exc}") from exc

    azp = claims.get("azp")
    if AUTHORIZED_PARTIES and azp not in AUTHORIZED_PARTIES:
        raise ValueError("Unauthorized party")

    return claims
