import os
from typing import List
from uuid import UUID

from sqlalchemy.orm import Session

from src.db import db_connection
from src.db.tables import Agent, Content, KnowledgeBase, Module, User
from src.dto import (
    ContentDTO,
    ContentListDTO,
    MessageDTO,
    MessageTextContentDTO,
    ResponseDTO,
)
from src.llm import BedrockHandler
from src.rag import RAGHandler


class ContentService:
    def __init__(self):
        self.db_conn = db_connection
        self.completion_handler = BedrockHandler()
        self.rag_handler = RAGHandler()
        self.knowledge_base_id = os.getenv("KNOWLEDGE_BASE_ID", None)

        text_content_creator_agent_id = os.getenv("TEXT_CONTENT_CREATOR_AGENT_ID", None)
        if not text_content_creator_agent_id:
            raise ValueError(
                "TEXT_CONTENT_CREATOR_AGENT_ID environment variable is not set."
            )

        with self.db_conn.get_session() as session:
            self.text_content_creator_agent = session.get(
                Agent, text_content_creator_agent_id
            )
            if not self.text_content_creator_agent:
                raise ValueError(
                    f"Agent with ID {text_content_creator_agent_id} not found in the database."
                )

    def generate_text_content(
        self,
        base_message: MessageDTO,
        session: Session,
        module_id: UUID,
        user: User,
        order: int,
        description: str,
        title: str,
        knowledge_base: KnowledgeBase = None,
    ) -> Content:
        """Generate text content using the completion handler.

        Args:
            base_message (MessageDTO): The base message for content generation.
            session (Session): The database session.
            module_id (UUID): The ID of the module.
            user (User): The currently authenticated user.
            order (int): The order of the content.
            knowledge_base (KnowledgeBase, optional): The knowledge base to use. Defaults to None.

        Returns:
            Content: The generated content object.
        """
        response_message = self.completion_handler.complete(
            session=session,
            message=base_message,
            user=user,
            agent=self.text_content_creator_agent,
            model_id="us.anthropic.claude-3-5-haiku-20241022-v1:0",
            knowledge_base=knowledge_base,
        )

        content = Content(
            module_id=module_id,
            title=title,
            description=description,
            content_type="text",
            text_content=response_message.content.text,
            order=order,
        )

        return content

    def generate_image_content(
        self,
        base_message: MessageDTO,
        session: Session,
        module_id: UUID,
        user: User,
        order: int,
        description: str,
        title: str,
        knowledge_base: KnowledgeBase = None,
    ) -> Content | None:
        """Retrieve image content from the knowledge base using RAG.

        Args:
            base_message (MessageDTO): The base message for content retrieval.
            session (Session): The database session.
            module_id (UUID): The ID of the module.
            user (User): The currently authenticated user.
            order (int): The order of the content.
            knowledge_base (KnowledgeBase, optional): The knowledge base to use. Defaults to None.

        Returns:
            Content | None: The retrieved content object or None if no content found.
        """
        if knowledge_base is None:
            return None

        referenced_documents, context = self.rag_handler.query(
            session=session,
            knowledge_base=knowledge_base,
            message=base_message,
            preferred_type="image",
            similarity_threshold=0,
            k=1,
        )

        if not referenced_documents or len(referenced_documents) == 0:
            return None

        content = Content(
            module_id=module_id,
            title=title,
            description=description,
            content_type="image",
            order=order,
            source_document_id=referenced_documents[0],
        )

        return content

    def generate_video_content(
        self,
        base_message: MessageDTO,
        session: Session,
        module_id: UUID,
        user: User,
        order: int,
        description: str,
        title: str,
        knowledge_base: KnowledgeBase = None,
    ) -> Content | None:
        """Retrieve video content from the knowledge base using RAG.

        Args:
            base_message (MessageDTO): The base message for content retrieval.
            session (Session): The database session.
            module_id (UUID): The ID of the module.
            user (User): The currently authenticated user.
            order (int): The order of the content.
            knowledge_base (KnowledgeBase, optional): The knowledge base to use. Defaults to None.

        Returns:
            Content | None: The retrieved content object or None if no content found.
        """
        if knowledge_base is None:
            return None

        referenced_documents, context = self.rag_handler.query(
            session=session,
            knowledge_base=knowledge_base,
            message=base_message,
            preferred_type="video",
            similarity_threshold=0,
            k=1,
        )

        if not referenced_documents or len(referenced_documents) == 0:
            return None

        content = Content(
            module_id=module_id,
            title=title,
            description=description,
            content_type="video",
            order=order,
            source_document_id=referenced_documents[0],
        )

        return content

    def generate_content(
        self,
        module_id: UUID,
        user_id: UUID,
        content_type: str,
        content_objective: str,
        content_title: str,
        order: int,
    ) -> Content:
        """Generate or retrieve multimedia content based on the specified type.

        Args:
            module_id (UUID): The ID of the module.
            user_id (UUID): The ID of the user.
            content_type (str): The type of content to generate (e.g., text, video, image).
            content_objective (str): The objective or purpose of the content.
            order (int): The order of the content in the module.

        Returns:
            Content: The generated or retrieved content object.
        """
        content_mapping = {
            "text": self.generate_text_content,
            "video": self.generate_video_content,
            "image": self.generate_image_content,
        }

        if content_type not in content_mapping:
            return None

        with self.db_conn.get_session() as session:
            user = User.get_by_id(session, user_id)
            knowledge_base = (
                KnowledgeBase.get_by_id(session, self.knowledge_base_id)
                if self.knowledge_base_id
                else None
            )

            message = MessageDTO(
                user_id=user_id,
                content=MessageTextContentDTO(
                    text=f"User Profile Data: {user.profile_info}\nContent Objective: {content_objective}"
                ),
                role="user",
            )

            content = content_mapping[content_type](
                base_message=message,
                session=session,
                module_id=module_id,
                user=user,
                order=order,
                title=content_title,
                description=content_objective,
                knowledge_base=knowledge_base,
            )

            if content:
                session.add(content)
                session.commit()

            return content

    def list_contents(self, module_id: UUID, user: User) -> List[ContentListDTO]:
        """List contents for a module.

        Args:
            module_id (UUID): The ID of the module.
            user (User): The currently authenticated user.

        Returns:
            List[ContentListDTO]: The list of contents belonging to the module.
        """
        with self.db_conn.get_session() as session:
            module = Module.get_by_id(session, module_id, user.id)
            contents = sorted(module.contents, key=lambda c: c.order)
            return ContentListDTO.from_entities(contents)

    def get_content(self, content_id: UUID, user: User) -> ContentDTO:
        """Get a specific content for a module.

        Args:
            content_id (UUID): The ID of the content.
            user (User): The currently authenticated user.

        Returns:
            ContentDTO: The requested content.
        """
        with self.db_conn.get_session() as session:
            content = Content.get_by_id(session, content_id, user.id)
            return ContentDTO.from_entity(content)

    def update_completed_status(
        self, content_id: UUID, user: User, completed: bool
    ) -> ResponseDTO:
        """Update content completion status.

        Args:
            content_id (UUID): The ID of the content.
            user (User): The currently authenticated user.

        Returns:
            ResponseDTO: The response message indicating success.
        """
        with self.db_conn.get_session() as session:
            content = Content.get_by_id(session, content_id, user.id)

            if completed:
                status = "completed"
            else:
                status = "created"

            content.status = status
            session.commit()

            return ResponseDTO(
                message=f"Content completion status set to '{status}' successfully.",
                status_code=200,
            )


content_service: ContentService = ContentService()
