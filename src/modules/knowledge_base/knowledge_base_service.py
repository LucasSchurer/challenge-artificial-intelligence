from typing import List
from uuid import UUID

from src.db import db_connection
from src.db.tables import Document, KnowledgeBase
from src.dto import (
    DocumentCreateDTO,
    DocumentDTO,
    DocumentListDTO,
    KnowledgeBaseCreateDTO,
    KnowledgeBaseDTO,
    ResponseDTO,
)
from src.rag import RAGHandler


class KnowledgeBaseService:
    def __init__(self):
        self.db_conn = db_connection
        self.rag_handler = RAGHandler()

    def create_knowledge_base(
        self, knowledge_base: KnowledgeBaseCreateDTO
    ) -> KnowledgeBaseDTO:
        """Create a new knowledge base.

        Args:
            knowledge_base (KnowledgeBaseCreateDTO): The data for the new knowledge base.

        Returns:
            KnowledgeBaseDTO: The created knowledge base data transfer object.
        """
        with self.db_conn.get_session() as session:
            knowledge_base = KnowledgeBase()
            session.add(knowledge_base)
            session.commit()
            return KnowledgeBaseDTO.from_entity(knowledge_base)

    def list_knowledge_bases(self) -> List[KnowledgeBaseDTO]:
        """List all knowledge bases.

        Returns:
            List[KnowledgeBaseDTO]: A list of knowledge base data transfer objects.
        """
        with self.db_conn.get_session() as session:
            knowledge_bases = session.query(KnowledgeBase).all()
            return [KnowledgeBaseDTO.from_entity(kb) for kb in knowledge_bases]

    def get_knowledge_base(self, knowledge_base_id: UUID) -> KnowledgeBaseDTO:
        """Get a knowledge base by its ID.

        Args:
            knowledge_base_id (UUID): The ID of the knowledge base to retrieve.

        Returns:
            KnowledgeBaseDTO: The knowledge base data transfer object.
        """
        with self.db_conn.get_session() as session:
            knowledge_base = KnowledgeBase.get_by_id(session, knowledge_base_id)
            return KnowledgeBaseDTO.from_entity(knowledge_base)

    def delete_knowledge_base(self, knowledge_base_id: UUID) -> ResponseDTO:
        """Delete a knowledge base by its ID.

        Args:
            knowledge_base_id (UUID): The ID of the knowledge base to delete.

        Returns:
            ResponseDTO: The response indicating the result of the deletion.
        """
        with self.db_conn.get_session() as session:
            knowledge_base = KnowledgeBase.get_by_id(session, knowledge_base_id)
            session.delete(knowledge_base)
            session.commit()
            return ResponseDTO(
                status_code=200, message="Knowledge base deleted successfully."
            )

    def add_document(
        self, knowledge_base_id: UUID, document: DocumentCreateDTO
    ) -> DocumentDTO:
        """Add a document to a knowledge base.

        Args:
            knowledge_base_id (UUID): The ID of the knowledge base.
            document (DocumentCreateDTO): The data for the new document.

        Returns:
            DocumentDTO: The created document data transfer object.
        """
        with self.db_conn.get_session() as session:
            knowledge_base = KnowledgeBase.get_by_id(
                session, document.knowledge_base_id
            )
            return DocumentDTO.from_entity(
                self.rag_handler.add_document(knowledge_base, document, session)
            )

    def list_documents(self, knowledge_base_id: UUID) -> List[DocumentListDTO]:
        """List all documents in a knowledge base.

        Args:
            knowledge_base_id (UUID): The ID of the knowledge base.

        Returns:
            List[DocumentDTO]: A list of document data transfer objects.
        """
        with self.db_conn.get_session() as session:
            knowledge_base = KnowledgeBase.get_by_id(session, knowledge_base_id)
            return DocumentListDTO.from_entities(knowledge_base.documents)

    def get_document(self, knowledge_base_id: UUID, document_id: UUID) -> DocumentDTO:
        """Get a document by its ID from a knowledge base.

        Args:
            knowledge_base_id (UUID): The ID of the knowledge base.
            document_id (UUID): The ID of the document to retrieve.

        Returns:
            DocumentDTO: The document data transfer object.
        """
        with self.db_conn.get_session() as session:
            document = Document.get_by_id(session, document_id)
            return DocumentDTO.from_entity(document)

    def remove_document(
        self, knowledge_base_id: UUID, document_id: UUID
    ) -> ResponseDTO:
        """Remove a document from a knowledge base.

        Args:
            knowledge_base_id (UUID): The ID of the knowledge base.
            document_id (UUID): The ID of the document to remove.

        Returns:
            ResponseDTO: The response indicating the result of the removal.
        """
        with self.db_conn.get_session() as session:
            document = Document.get_by_id(session, document_id)
            session.delete(document)
            session.commit()
            return ResponseDTO(
                status_code=200, message="Document removed successfully."
            )

    def populate_test_data(self) -> ResponseDTO:
        import os

        import dotenv

        dotenv.load_dotenv(override=True)

        test_data_dir = os.getenv("RAG_TEST_DATA_DIR", None)
        if not test_data_dir:
            return ResponseDTO(
                status_code=400,
                message="RAG_TEST_DATA_DIR environment variable is not set.",
            )

        with self.db_conn.get_session() as session:
            knowledge_base = KnowledgeBase()
            session.add(knowledge_base)
            session.commit()

            for file in os.listdir(test_data_dir):
                print(f"Processing file: {file}")
                file_path = os.path.join(test_data_dir, file)
                if os.path.isfile(file_path):
                    with open(file_path, "rb") as f:
                        file_data = f.read()

                    document_extension = file.split(".")[-1]
                    document_type = None

                    if document_extension in ["txt", "pdf", "json"]:
                        document_type = "text"
                    elif document_extension in ["jpeg", "png", "jpg"]:
                        document_type = "image"
                    elif document_extension in ["mp4"]:
                        document_type = "video"
                    else:
                        print(f"Unsupported file type: {document_extension}, skipping.")
                        continue

                    document_dto = DocumentCreateDTO(
                        knowledge_base_id=knowledge_base.id,
                        document_type=document_type,
                        document_extension=document_extension,
                        name=file,
                        data=file_data,
                    )

                    self.rag_handler.add_document(knowledge_base, document_dto, session)

            return ResponseDTO(
                status_code=200, message="Test data populated successfully."
            )


knowledge_base_service: KnowledgeBaseService = KnowledgeBaseService()
