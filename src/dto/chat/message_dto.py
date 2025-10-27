from typing import Literal, Optional, Union
from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO


class MessageTextContentDTO(BaseDTO):
    content_type: Literal["text"] = "text"
    text: str = Field(alias="text")


class MessageDictContentDTO(BaseDTO):
    content_type: Literal["dict"] = "dict"
    data: dict = Field(alias="data")


class MessageBaseDTO(BaseDTO):
    chat_id: Optional[UUID] = Field(alias="chat_id", default=None)
    content: Union[MessageTextContentDTO, MessageDictContentDTO] = Field(
        alias="content", discriminator="content_type"
    )


class MessageDTO(MessageBaseDTO):
    role: Literal["user", "assistant"] = Field(alias="role")

    @classmethod
    def from_entity(cls, message_entity) -> "MessageDTO":
        if message_entity.content_type == "text":
            content_dto = MessageTextContentDTO(text=message_entity.text_content)
        elif message_entity.content_type == "dict":
            content_dto = MessageDictContentDTO(data=message_entity.dict_content)
        else:
            raise ValueError("Unknown content type")

        return cls(
            message_id=message_entity.id,
            chat_id=message_entity.chat_id,
            role=message_entity.role,
            content=content_dto,
        )
