from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO, MessageDTO
from typing import Optional
from src.db.tables import Plan


class PlanBaseDTO(BaseDTO):
    title: str = Field(alias="title")
    user_id: UUID = Field(alias="user_id")
    description: Optional[str] = Field(alias="description", default=None)
    chat_id: Optional[UUID] = Field(alias="chat_id", default=None)


class PlanDTO(PlanBaseDTO):
    id: UUID = Field(alias="plan_id")

    last_message: Optional[MessageDTO] = Field(alias="last_message", default=None)

    @classmethod
    def from_entity(cls: type["PlanDTO"], entity: Plan) -> "PlanDTO":
        dto = cls.model_validate(entity)

        if entity.chat:
            last_message = entity.chat.messages[-1] if entity.chat.messages else None
            if last_message:
                dto.last_message = MessageDTO.from_entity(last_message)

        return dto


class PlanCreateDTO(PlanBaseDTO):
    pass
