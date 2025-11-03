import json
from typing import List
from uuid import UUID

import boto3
from fastapi import HTTPException
from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
from sqlalchemy.orm import Session

from src.db.tables import Agent, Chat, KnowledgeBase, Message, User
from src.dto import MessageDictContentDTO, MessageDTO, MessageTextContentDTO
from src.rag import RAGHandler


class BedrockHandler:
    def __init__(self):
        self.client: BedrockRuntimeClient = boto3.client(
            "bedrock-runtime", region_name="us-east-2"
        )

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

    def complete(
        self,
        session: Session,
        message: MessageDTO,
        user: User,
        system_prompt: str = None,
        agent: Agent = None,
        knowledge_base: KnowledgeBase = None,
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
        chat = self.__get_create_chat(session, message.chat_id, user)
        self.__create_db_message(session, chat, message)

        messages = chat.messages

        formatted_messages = [
            self.__format_message_for_bedrock(msg) for msg in messages
        ]

        system = []
        output_format = None
        if system_prompt:
            system.append({"text": system_prompt})

        if agent:
            if agent.system_prompt:
                system.append({"text": agent.system_prompt})

            if agent.output_format:
                output_format = agent.output_format
                output_format = {"toolSpec": output_format}

        if knowledge_base:
            rag_handler = RAGHandler()
            referenced_documents, retrieved_context = rag_handler.query(
                session, knowledge_base, message
            )
            if retrieved_context:
                system.append(
                    {
                        "text": f"[START RAG CONTEXT]:\n{retrieved_context}[END RAG CONTEXT]"
                    }
                )

        try:
            if output_format:
                response = self.client.converse(
                    modelId=model_id,
                    messages=formatted_messages,
                    system=system,
                    toolConfig={
                        "tools": [output_format],
                        "toolChoice": {
                            "tool": {"name": output_format["toolSpec"]["name"]}
                        },
                    },
                )

                content = MessageDictContentDTO(
                    data=response["output"]["message"]["content"][0]["toolUse"][
                        "input"
                    ],
                )
            else:
                response = self.client.converse(
                    modelId=model_id,
                    messages=formatted_messages,
                    system=system,
                )
                content = MessageTextContentDTO(
                    text=response["output"]["message"]["content"][0]["text"]
                )
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error during Bedrock completion: {str(e)}"
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
