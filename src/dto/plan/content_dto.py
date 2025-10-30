from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO, MessageDTO
from typing import Optional, Literal
from src.db.tables import Plan


class ContentBaseDTO(BaseDTO):
    module_id: UUID = Field(alias="module_id")
    content_type: Literal["text"] = Field(alias="content_type")
    title: str = Field(alias="title")
    order: int = Field(alias="order", default=0)
    status: Literal["created", "completed"] = Field(alias="status", default="created")


class ContentDTO(ContentBaseDTO):
    id: UUID = Field(alias="content_id")
    text_content: Optional[str] = Field(alias="text_content", default=None)


class ContentListDTO(ContentBaseDTO):
    id: UUID = Field(alias="content_id")


class ContentCreateDTO(ContentBaseDTO):
    text_content: Optional[str] = Field(alias="text_content", default=None)
