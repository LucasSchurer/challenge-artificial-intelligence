from os import getenv

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader

from src.db import db_connection
from src.db.tables import User

oauth2_scheme = APIKeyHeader(name="Authorization")


def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        token = token.replace("Bearer ", "")
        secret_key = getenv("JWT_SECRET_KEY", None)
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        with db_connection.get_session() as session:
            user = session.get(User, user_id)
            if user is None:
                raise HTTPException(status_code=401, detail="User not found")

            return user

    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
