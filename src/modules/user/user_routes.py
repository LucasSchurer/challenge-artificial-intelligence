from uuid import UUID

from fastapi import APIRouter, Depends

from src.dto import (
    ResponseDTO,
    UserCreateDTO,
    UserDTO,
    UserLoginDTO,
    UserLoginResponseDTO,
)
from src.security import get_current_user

from .user_service import user_service

user_router = APIRouter()


@user_router.post("", response_model=UserDTO)
def create_user(user: UserCreateDTO):
    return user_service.create_user(user)


@user_router.post("/login", response_model=UserLoginResponseDTO)
def login_user(user: UserLoginDTO):
    return user_service.login_user(user)


@user_router.delete("/{user_id}", response_model=ResponseDTO)
def delete_user(user_id: UUID, current_user=Depends(get_current_user)):
    return user_service.delete_user(user_id, current_user)
