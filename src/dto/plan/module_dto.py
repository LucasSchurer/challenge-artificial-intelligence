from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO
from typing import Optional, Literal
from .content_dto import ContentDTO


class ModuleBaseDTO(BaseDTO):
    plan_id: UUID = Field(alias="plan_id")
    title: str = Field(alias="title")
    description: Optional[str] = Field(alias="description", default=None)
    order: int = Field(alias="order")
    status: Literal["creating_outline", "creating_contents", "created", "completed"] = (
        Field(alias="status")
    )


class ModuleListDTO(ModuleBaseDTO):
    id: UUID = Field(alias="module_id")


class ModuleDTO(ModuleBaseDTO):
    id: UUID = Field(alias="module_id")
    contents: Optional[list[ContentDTO]] = Field(alias="contents", default=None)


class ModuleCreateDTO(ModuleBaseDTO):
    pass
