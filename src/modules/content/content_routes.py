from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from src.dto import ContentDTO, ContentListDTO, ResponseDTO
from src.security import get_current_user

from .content_service import content_service

content_router = APIRouter()


@content_router.get("", response_model=List[ContentListDTO])
def list_contents(
    plan_id: UUID,
    module_id: UUID,
    current_user=Depends(get_current_user),
):
    return content_service.list_contents(module_id, current_user)


@content_router.get("/{content_id}", response_model=ContentDTO)
def get_content(
    plan_id: UUID,
    module_id: UUID,
    content_id: UUID,
    current_user=Depends(get_current_user),
):
    return content_service.get_content(content_id, current_user)


@content_router.put(
    "/{content_id}/complete",
    response_model=ResponseDTO,
)
def update_completed_status(
    plan_id: UUID,
    module_id: UUID,
    content_id: UUID,
    completed: bool = Query(..., description="Completion status to set"),
    current_user=Depends(get_current_user),
):
    return content_service.update_completed_status(content_id, current_user, completed)
