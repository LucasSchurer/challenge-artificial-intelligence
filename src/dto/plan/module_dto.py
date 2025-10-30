from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO
from typing import Optional, Literal
from .content_dto import ContentListDTO
from src.db.tables import Module


class ModuleBaseDTO(BaseDTO):
    plan_id: UUID = Field(alias="plan_id")
    title: str = Field(alias="title")
    description: Optional[str] = Field(alias="description", default=None)
    order: int = Field(alias="order")
    status: Literal["creating_outline", "creating_contents", "created", "completed"] = (
        Field(alias="status")
    )
    progress: int = Field(alias="progress", default=0)
    contents_count: int = Field(alias="contents_count", default=0)

    @classmethod
    def from_entity(cls, entity: Module):
        dto: ModuleBaseDTO = super().from_entity(entity)
        dto.contents_count = len(entity.contents)

        for content in entity.contents:
            if content.status == "completed":
                dto.progress += 1

        return dto


class ModuleListDTO(ModuleBaseDTO):
    id: UUID = Field(alias="module_id")


class ModuleDTO(ModuleBaseDTO):
    id: UUID = Field(alias="module_id")
    contents: Optional[list[ContentListDTO]] = Field(alias="contents", default=None)


class ModuleCreateDTO(ModuleBaseDTO):
    pass
