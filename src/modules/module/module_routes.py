from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from src.dto import ModuleDTO, ModuleListDTO, ResponseDTO
from src.security import get_current_user

from .module_service import module_service

module_router = APIRouter()


@module_router.get("", response_model=List[ModuleListDTO])
def list_modules(plan_id: UUID, current_user=Depends(get_current_user)):
    return module_service.list_modules(plan_id, current_user)


@module_router.get("/{module_id}", response_model=ModuleDTO)
def get_module(plan_id: UUID, module_id: UUID, current_user=Depends(get_current_user)):
    return module_service.get_module(module_id, current_user)


@module_router.put("/{module_id}/complete", response_model=ResponseDTO)
def update_completed_status(
    plan_id: UUID,
    module_id: UUID,
    completed: bool = Query(..., description="Completion status to set"),
    current_user=Depends(get_current_user),
):
    return module_service.update_completed_status(module_id, current_user, completed)
