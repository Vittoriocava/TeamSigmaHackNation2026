from fastapi import HTTPException, Request
from jose import jwt, JWTError
from app.config import get_settings


def get_token_from_header(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante")
    return auth[7:]


def verify_token(token: str) -> str:
    """Decode Supabase JWT and return user_id."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token non valido")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Token non valido o scaduto")


def get_current_user(request: Request) -> str:
    """FastAPI dependency — extracts and verifies user_id from JWT."""
    token = get_token_from_header(request)
    return verify_token(token)
