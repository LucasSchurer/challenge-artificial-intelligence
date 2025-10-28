from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends

from src.db.tables import User
from src.dto import (
    ChatDTO,
    MessageDTO,
    ResponseDTO,
    PlanDTO,
    ModuleListDTO,
    ContentDTO,
    ModuleDTO,
)
from src.security import get_current_user

from .plan_service import plan_service

plan_router = APIRouter()


@plan_router.get("", response_model=List[PlanDTO])
def list_plans(current_user=Depends(get_current_user)) -> List[PlanDTO]:
    return plan_service.list_plans(current_user)


@plan_router.post("", response_model=PlanDTO)
def create_plan(current_user=Depends(get_current_user)) -> PlanDTO:
    return plan_service.create_plan(current_user)


@plan_router.post("/{plan_id}/develop", response_model=PlanDTO)
def develop_plan(
    message: MessageDTO, plan_id: UUID, current_user=Depends(get_current_user)
):
    return plan_service.develop_plan(plan_id, current_user, message)


@plan_router.get("/{plan_id}/modules", response_model=List[ModuleListDTO])
def list_modules(plan_id: UUID, current_user=Depends(get_current_user)):
    return plan_service.list_modules(plan_id, current_user)


@plan_router.get("/{plan_id}/modules/{module_id}", response_model=ModuleDTO)
def get_module(plan_id: UUID, module_id: UUID, current_user=Depends(get_current_user)):
    return plan_service.get_module(plan_id, module_id, current_user)
