from typing import List

from fastapi import APIRouter

from src.dto import (
    DocumentCreateDTO,
    DocumentDTO,
    DocumentListDTO,
    KnowledgeBaseCreateDTO,
    KnowledgeBaseDTO,
    ResponseDTO,
)

from .knowledge_base_service import knowledge_base_service

knowledge_base_router = APIRouter()


@knowledge_base_router.post("", response_model=KnowledgeBaseDTO)
def create_knowledge_base(
    knowledge_base: KnowledgeBaseCreateDTO,
) -> KnowledgeBaseDTO:
    return knowledge_base_service.create_knowledge_base(knowledge_base)


@knowledge_base_router.get("", response_model=List[KnowledgeBaseDTO])
def list_knowledge_bases() -> List[KnowledgeBaseDTO]:
    return knowledge_base_service.list_knowledge_bases()


@knowledge_base_router.get("/{knowledge_base_id}", response_model=KnowledgeBaseDTO)
def get_knowledge_base(knowledge_base_id: str) -> KnowledgeBaseDTO:
    return knowledge_base_service.get_knowledge_base(knowledge_base_id)


@knowledge_base_router.delete("/{knowledge_base_id}", response_model=ResponseDTO)
def delete_knowledge_base(knowledge_base_id: str) -> ResponseDTO:
    return knowledge_base_service.delete_knowledge_base(knowledge_base_id)


@knowledge_base_router.get(
    "/{knowledge_base_id}/documents", response_model=List[DocumentListDTO]
)
def list_documents(knowledge_base_id: str) -> List[DocumentListDTO]:
    return knowledge_base_service.list_documents(knowledge_base_id)


@knowledge_base_router.get(
    "/{knowledge_base_id}/documents/{document_id}", response_model=DocumentDTO
)
def get_document(knowledge_base_id: str, document_id: str) -> DocumentDTO:
    return knowledge_base_service.get_document(knowledge_base_id, document_id)


@knowledge_base_router.post(
    "/{knowledge_base_id}/documents", response_model=DocumentDTO
)
def add_document(knowledge_base_id: str, document: DocumentCreateDTO) -> DocumentDTO:
    return knowledge_base_service.add_document(knowledge_base_id, document)


@knowledge_base_router.delete(
    "/{knowledge_base_id}/documents/{document_id}", response_model=ResponseDTO
)
def remove_document(knowledge_base_id: str, document_id: str) -> ResponseDTO:
    return knowledge_base_service.remove_document(knowledge_base_id, document_id)


@knowledge_base_router.post("/populate_test_data", response_model=ResponseDTO)
def populate_test_data() -> ResponseDTO:
    return knowledge_base_service.populate_test_data()
