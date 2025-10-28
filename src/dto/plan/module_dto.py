from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO, MessageDTO
from typing import Optional
from src.db.tables import Plan


class ModuleBaseDTO(BaseDTO):
    plan_id: UUID = Field(alias="plan_id")
    title: str = Field(alias="title")
    description: Optional[str] = Field(alias="description", default=None)
    order: int = Field(alias="order")


class ModuleListDTO(ModuleBaseDTO):
    id: UUID = Field(alias="module_id")


class ModuleDTO(ModuleBaseDTO):
    id: UUID = Field(alias="module_id")


class ModuleCreateDTO(ModuleBaseDTO):
    pass
