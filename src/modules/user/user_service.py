import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
import jwt
from fastapi import HTTPException

from src.db import db_connection
from src.db.tables import User
from src.dto import (
    ResponseDTO,
    UserCreateDTO,
    UserDTO,
    UserLoginDTO,
    UserLoginResponseDTO,
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", None)


class UserService:
    def __init__(self):
        self.db_conn = db_connection

    def __create_jwt(self, user_id: UUID, duration=timedelta(days=7)):
        """Create a JSON Web Token (JWT) for a user.

        Args:
            user_id (UUID): The ID of the account.
            duration (timedelta, optional): The duration for which the token is valid. Defaults to timedelta(days=7).

        Returns:
            str: The encoded JWT.
        """
        payload = {
            "user_id": str(user_id),
            "exp": datetime.now(timezone.utc) + duration,
            "iat": datetime.now(timezone.utc),
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
        return token

    def __verify_password(self, password: str, hashed: str) -> bool:
        """Verify a user's password against the stored hashed password.

        Args:
            password (str): The plain text password.
            hashed (str): The hashed password.

        Returns:
            bool: True if the password is correct, False otherwise.
        """
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

    def __hash_password(self, password: str) -> str:
        """Hash a user's password.

        Args:
            password (str): The plain text password.

        Returns:
            str: The hashed password.
        """
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    def create_user(self, user: UserCreateDTO) -> UserDTO:
        """Create a new user.

        Args:
            user (UserCreateDTO): The user data.

        Raises:
            HTTPException: If the username already exists.

        Returns:
            UserDTO: The created user data.
        """
        username = user.username
        password = user.password
        name = user.name

        with self.db_conn.get_session() as session:
            if session.query(User).filter((User.username == username)).first():
                raise HTTPException(status_code=400, detail="Username already exists!")

            password = self.__hash_password(password)

            user = User(
                name=name,
                username=username,
                password=password,
            )

            session.add(user)
            session.commit()

            return UserDTO.from_entity(user)

    def delete_user(self, user_id: UUID, user: User) -> ResponseDTO:
        """Delete a user.

        Args:
            user_id (UUID): The ID of the user to delete.
            user (User): The currently authenticated user.

        Raises:
            HTTPException: If the user does not exist or if the current user is not authorized to delete the user.


        Returns:
            ResponseDTO: The response message indicating success.
        """
        with self.db_conn.get_session() as session:
            user = session.get(User, user_id)

            if not user:
                raise HTTPException(status_code=404, detail="User not found!")

            if user.id != user.id:
                raise HTTPException(
                    status_code=403, detail="Not authorized to delete this user!"
                )

            session.delete(user)
            session.commit()

            return ResponseDTO(status_code=200, message="User deleted successfully")

    def login_user(self, user: UserLoginDTO) -> UserLoginResponseDTO:
        """Login an user.

        Args:
            user (UserLoginDTO): The user login data.

        Raises:
            HTTPException: If the user does not exist or if the credentials are invalid.
            HTTPException: If the user is not authorized.

        Returns:
            UserLoginResponseDTO: The response containing the JWT token.
        """
        username = user.username
        password = user.password

        with self.db_conn.get_session() as session:
            user = session.query(User).filter_by(username=username).first()
            if not user:
                raise HTTPException(status_code=401, detail="User not found!")

            if not self.__verify_password(password, user.password):
                raise HTTPException(status_code=401, detail="Invalid credentials!")

            token = self.__create_jwt(user.id)
            return UserLoginResponseDTO(token=token, id=user.id)


user_service: UserService = UserService()
