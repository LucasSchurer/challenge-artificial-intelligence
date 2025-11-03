from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import Field

from src.db.tables import Plan
from src.dto import BaseDTO, MessageDTO


class PlanBaseDTO(BaseDTO):
    title: str = Field(alias="title")
    user_id: UUID = Field(alias="user_id")
    description: Optional[str] = Field(alias="description", default=None)
    chat_id: Optional[UUID] = Field(alias="chat_id", default=None)
    status: Literal["creating_outline", "creating_modules", "created", "completed"] = (
        Field(alias="status")
    )
    progress: int = Field(alias="progress", default=0)
    modules_count: int = Field(alias="modules_count", default=0)

    @classmethod
    def from_entity(cls, entity: Plan):
        dto: PlanBaseDTO = super().from_entity(entity)
        dto.modules_count = len(entity.modules)

        for module in entity.modules:
            if module.status == "completed":
                dto.progress += 1

        return dto


class PlanDTO(PlanBaseDTO):
    id: UUID = Field(alias="plan_id")

    created_at: datetime = Field(alias="created_at")
    last_viewed_at: datetime = Field(alias="last_viewed_at")
    last_message: Optional[MessageDTO] = Field(alias="last_message", default=None)

    @classmethod
    def from_entity(cls: type["PlanDTO"], entity: Plan) -> "PlanDTO":
        dto = super().from_entity(entity)

        if entity.chat:
            last_message = entity.chat.messages[-1] if entity.chat.messages else None
            if last_message:
                dto.last_message = MessageDTO.from_entity(last_message)

        return dto


class PlanWithAllMessagesDTO(PlanDTO):
    messages: Optional[list[MessageDTO]] = Field(alias="messages", default=None)

    @classmethod
    def from_entity(
        cls: type["PlanWithAllMessagesDTO"], entity: Plan
    ) -> "PlanWithAllMessagesDTO":
        dto = super().from_entity(entity)

        if entity.chat:
            dto.messages = [
                MessageDTO.from_entity(message) for message in entity.chat.messages[1:]
            ]

        return dto


class PlanCreateDTO(PlanBaseDTO):
    pass
