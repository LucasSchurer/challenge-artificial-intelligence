from typing import Literal, Optional
from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO


class ContentBaseDTO(BaseDTO):
    module_id: UUID = Field(alias="module_id")
    content_type: Literal["text", "video", "image"] = Field(alias="content_type")
    title: str = Field(alias="title")
    order: int = Field(alias="order", default=0)
    status: Literal["created", "completed"] = Field(alias="status", default="created")
    description: Optional[str] = Field(alias="description", default=None)


class ContentDTO(ContentBaseDTO):
    id: UUID = Field(alias="content_id")
    text_content: Optional[str] = Field(alias="text_content", default=None)
    source_document_id: Optional[UUID] = Field(alias="source_document_id", default=None)


class ContentListDTO(ContentBaseDTO):
    id: UUID = Field(alias="content_id")


class ContentCreateDTO(ContentBaseDTO):
    text_content: Optional[str] = Field(alias="text_content", default=None)
