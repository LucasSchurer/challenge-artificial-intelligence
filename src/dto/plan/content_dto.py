from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO, MessageDTO
from typing import Optional, Literal
from src.db.tables import Plan


class ContentBaseDTO(BaseDTO):
    module_id: UUID = Field(alias="module_id")
    text_content: Optional[str] = Field(alias="text_content", default=None)
    content_type: Literal["text"] = Field(alias="content_type")


class ContentDTO(ContentBaseDTO):
    id: UUID = Field(alias="content_id")


class ContentCreateDTO(ContentBaseDTO):
    pass
