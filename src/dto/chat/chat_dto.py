from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO


class ChatBaseDTO(BaseDTO):
    label: str = Field(alias="label")


class ChatDTO(ChatBaseDTO):
    id: UUID = Field(alias="chat_id")
