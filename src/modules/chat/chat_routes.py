from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends

from src.db.tables import User
from src.dto import ChatDTO, MessageDTO, ResponseDTO
from src.security import get_current_user

from .chat_service import chat_service

chat_router = APIRouter()


@chat_router.get("", response_model=List[ChatDTO])
def list_chats(user: User = Depends(get_current_user)):
    return chat_service.list_chats(user)


@chat_router.post("/message", response_model=MessageDTO)
def message(
    message: MessageDTO,
    user: User = Depends(get_current_user),
):
    return chat_service.handle_message(message, user)


@chat_router.get("/{chat_id}/messages", response_model=list[MessageDTO])
def get_chat_messages(
    chat_id: UUID,
    user: User = Depends(get_current_user),
):
    return chat_service.get_chat_messages(chat_id, user)


@chat_router.delete("/{chat_id}", response_model=ResponseDTO)
def delete_chat(
    chat_id: UUID,
    user: User = Depends(get_current_user),
):
    return chat_service.delete_chat(chat_id, user)
