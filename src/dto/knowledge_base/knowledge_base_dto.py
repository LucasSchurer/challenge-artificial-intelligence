from uuid import UUID

from pydantic import Field

from src.dto import BaseDTO


class KnowledgeBaseBaseDTO(BaseDTO):
    pass


class KnowledgeBaseDTO(KnowledgeBaseBaseDTO):
    id: UUID = Field(alias="knowledge_base_id")


class KnowledgeBaseCreateDTO(KnowledgeBaseBaseDTO):
    pass
