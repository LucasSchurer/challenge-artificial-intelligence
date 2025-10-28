import json
from typing import List
from uuid import UUID

import boto3
from fastapi import HTTPException
from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
from sqlalchemy.orm import Session

from src.db import db_connection
from src.db.tables import Chat, Message, User, Agent
from src.dto import (
    ChatDTO,
    MessageDictContentDTO,
    MessageDTO,
    MessageTextContentDTO,
    ResponseDTO,
)

from src.llm import BedrockHandler


class ChatService:
    def __init__(self):
        self.db_conn = db_connection
        self.handler = BedrockHandler()

    def list_chats(self, user: User) -> List[ChatDTO]:
        """List chats for a user.

        Args:
            user (User): The currently authenticated user.

        Returns:
            List[ChatDTO]: The list of chats belonging to the user.
        """
        with self.db_conn.get_session() as session:
            chats = session.query(Chat).filter(Chat.user_id == user.id).all()
            return ChatDTO.from_entities(chats)

    def handle_message(
        self,
        message: MessageDTO,
        user: User,
        model_id: str = "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    ) -> MessageDTO:
        """Handle an incoming message and get a response from the Bedrock model.

        Args:
            message (MessageDTO): The incoming message.
            user (User): The currently authenticated user.
            model_id (str, optional): The Bedrock model ID to use. Defaults to "us.anthropic.claude-3-5-haiku-20241022-v1:0".

        Returns:
            MessageDTO: The response message from the Bedrock model.
        """
        with self.db_conn.get_session() as session:
            agent = session.get(Agent, "440f74fd-85b7-4342-b900-435cb1f04b06")
            response_message = self.handler.complete(
                session=session, message=message, user=user, agent=agent
            )
            return response_message

    def get_chat_messages(self, chat_id: UUID, user: User) -> List[MessageDTO]:
        """Get messages for a specific chat.

        Args:
            chat_id (UUID): The ID of the chat.
            user (User): The currently authenticated user.

        Raises:
            HTTPException: If the chat does not exist or does not belong to the user.

        Returns:
            List[MessageDTO]: The list of messages in the chat, ordered by creation time.
        """
        with self.db_conn.get_session() as session:
            chat = (
                session.query(Chat)
                .filter(Chat.id == chat_id, Chat.user_id == user.id)
                .first()
            )
            if chat is None:
                raise HTTPException(status_code=404, detail="Chat not found")

            messages = (
                session.query(Message)
                .filter(Message.chat_id == chat.id)
                .order_by(Message.created_at)
                .all()
            )

            return MessageDTO.from_entities(messages)

    def delete_chat(self, chat_id: UUID, user: User) -> ResponseDTO:
        """Delete a chat.

        Args:
            chat_id (UUID): The ID of the chat to delete.
            user (User): The currently authenticated user.

        Raises:
            HTTPException: If the chat does not exist or does not belong to the user.

        Returns:
            ResponseDTO: The response message indicating success.
        """
        with self.db_conn.get_session() as session:
            chat = (
                session.query(Chat)
                .filter(Chat.id == chat_id, Chat.user_id == user.id)
                .first()
            )

            if chat is None:
                raise HTTPException(status_code=404, detail="Chat not found")

            session.delete(chat)
            session.commit()

            return ResponseDTO(status_code=200, message="Chat deleted successfully")


chat_service: ChatService = ChatService()
