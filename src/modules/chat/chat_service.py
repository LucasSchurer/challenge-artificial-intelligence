import json
from typing import List
from uuid import UUID

import boto3
from fastapi import HTTPException
from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
from sqlalchemy.orm import Session

from src.db import db_connection
from src.db.tables import Chat, Message, User
from src.dto import (
    ChatDTO,
    MessageDictContentDTO,
    MessageDTO,
    MessageTextContentDTO,
    ResponseDTO,
)


class ChatService:
    def __init__(self):
        self.db_conn = db_connection
        self.client: BedrockRuntimeClient = boto3.client(
            "bedrock-runtime", region_name="us-east-2"
        )

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

    def __get_create_chat(self, session: Session, chat_id: UUID, user: User) -> Chat:
        """Get or create a chat for the user.

        Args:
            session (Session): The database session.
            chat_id (UUID): The ID of the chat to retrieve or create.
            user (User): The user for whom the chat is being created.

        Raises:
            HTTPException: If the chat does not exist and cannot be created.

        Returns:
            Chat: The retrieved or newly created chat.
        """
        if chat_id is None:
            chat = Chat(user_id=user.id)
            session.add(chat)
            session.flush()
        else:
            chat = (
                session.query(Chat)
                .filter(Chat.id == chat_id, Chat.user_id == user.id)
                .first()
            )
            if chat is None:
                raise HTTPException(status_code=404, detail="Chat not found")

        return chat

    def __format_message_for_bedrock(self, message: Message) -> List[dict]:
        """Format a message for Bedrock API.

        Args:
            message (Message): The message to format.

        Returns:
            List[dict]: The formatted message.
        """
        formatted_message = {"role": message.role, "content": []}
        if message.content_type == "text":
            formatted_message["content"].append({"text": message.text_content})

        elif message.content_type == "dict":
            formatted_message["content"].append(
                {"text": json.dumps(message.dict_content)}
            )

        return formatted_message

    def __create_db_message(
        self, session: Session, chat: Chat, message: MessageDTO
    ) -> Message:
        """Create a new message in the database using the provided MessageDTO.

        Args:
            session (Session): The database session.
            chat (Chat): The chat to which the message belongs.
            message (MessageDTO): The message data transfer object.

        Returns:
            Message: The newly created message entity.
        """
        new_message = Message(
            chat_id=chat.id,
            role=message.role,
            content_type=message.content.content_type,
        )

        if isinstance(message.content, MessageTextContentDTO):
            new_message.text_content = message.content.text
        elif isinstance(message.content, MessageDictContentDTO):
            new_message.dict_content = message.content.data

        session.add(new_message)
        session.flush()

        return new_message

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
            chat = self.__get_create_chat(session, message.chat_id, user)
            self.__create_db_message(session, chat, message)

            messages = chat.messages
            formatted_messages = [
                self.__format_message_for_bedrock(msg) for msg in messages
            ]

            response = self.client.converse(
                modelId=model_id,
                messages=formatted_messages,
            )

            content = MessageTextContentDTO(
                text=response["output"]["message"]["content"][0]["text"]
            )

            role = response["output"]["message"]["role"]

            response_message = MessageDTO(
                chat_id=chat.id,
                role=role,
                content=content,
            )

            self.__create_db_message(session, chat, response_message)
            session.commit()

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
