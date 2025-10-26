from uuid import UUID

from pydantic import Field, field_validator

from src.dto import BaseDTO


class UserBaseDTO(BaseDTO):
    name: str = Field(alias="name")
    username: str = Field(alias="username")

    @field_validator("username")
    def validate_username(cls, v: str) -> str:
        if " " in v:
            raise ValueError("Username must not contain spaces")
        return v


class UserDTO(UserBaseDTO):
    id: UUID = Field(alias="id")


class UserCreateDTO(UserBaseDTO):
    password: str = Field(alias="password")


class UserLoginResponseDTO(BaseDTO):
    token: str = Field(alias="token")
    id: UUID = Field(alias="id")


class UserLoginDTO(BaseDTO):
    username: str = Field(alias="username")
    password: str = Field(alias="password")
