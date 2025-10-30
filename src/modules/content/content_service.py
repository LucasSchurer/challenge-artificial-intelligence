import json
from typing import List
from uuid import UUID

import boto3
from fastapi import HTTPException
from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
from sqlalchemy.orm import Session

from src.db import db_connection
from src.db.tables import Chat, Message, User, Agent, Plan, Module, Content
from src.dto import (
    PlanCreateDTO,
    PlanDTO,
    ModuleListDTO,
    ContentDTO,
    MessageDTO,
    MessageTextContentDTO,
    ModuleDTO,
    PlanWithAllMessagesDTO,
    ResponseDTO,
    ContentListDTO,
)
import os

from src.llm import BedrockHandler
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio


class ContentService:
    def __init__(self):
        self.db_conn = db_connection
        self.handler = BedrockHandler()

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
    ) -> Content:
        response_message = self.handler.complete(
            session=session,
            message=base_message,
            user=user,
            agent=self.text_content_creator_agent,
            model_id="us.anthropic.claude-3-5-haiku-20241022-v1:0",
        )

        content = Content(
            module_id=module_id,
            title="Generated Text Content",
            content_type="text",
            text_content=response_message.content.text,
            order=order,
        )

        session.add(content)
        session.commit()

        return content

    def generate_content(
        self,
        module_id: UUID,
        user_id: UUID,
        content_type: str,
        content_objective: str,
        order: int,
    ) -> Content:
        content_mapping = {
            "text": self.generate_text_content,
        }

        if content_type not in content_mapping:
            return None

        with self.db_conn.get_session() as session:
            user = session.get(User, user_id)

            message = MessageDTO(
                user_id=user_id,
                content=MessageTextContentDTO(
                    text=f"User Profile Data: {user.profile_info}\nContent Objective: {content_objective}"
                ),
                role="user",
            )

            return content_mapping[content_type](
                base_message=message,
                session=session,
                module_id=module_id,
                user=user,
                order=order,
            )

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

    def complete_content(self, content_id: UUID, user: User) -> ResponseDTO:
        """Complete content for a specific plan.

        Args:
            content_id (UUID): The ID of the content.
            user (User): The currently authenticated user.

        Returns:
            ResponseDTO: The response message indicating success.
        """
        with self.db_conn.get_session() as session:
            content = Content.get_by_id(session, content_id, user.id)

            content.status = "completed"
            session.commit()

            return ResponseDTO(
                status_code=200, message="Content completed successfully."
            )


content_service: ContentService = ContentService()
