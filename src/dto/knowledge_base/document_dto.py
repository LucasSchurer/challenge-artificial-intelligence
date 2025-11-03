from typing import Literal
from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO


class DocumentBaseDTO(BaseDTO):
    knowledge_base_id: UUID = Field(alias="knowledge_base_id")
    document_type: Literal["text", "image", "video"] = Field(alias="document_type")
    document_extension: Literal["pdf", "txt", "jpeg", "png", "json", "mp4", "jpg"] = (
        Field(alias="document_extension")
    )
    name: str = Field(alias="name")


class DocumentDTO(DocumentBaseDTO):
    id: UUID = Field(alias="document_id")
    data: bytes = Field(alias="data")


class DocumentListDTO(DocumentBaseDTO):
    id: UUID = Field(alias="document_id")


class DocumentCreateDTO(DocumentBaseDTO):
    data: bytes = Field(alias="data")
