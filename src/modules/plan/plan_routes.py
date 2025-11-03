from typing import List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends

from src.dto import MessageDTO, PlanDTO, PlanWithAllMessagesDTO
from src.modules.module.module_service import module_service
from src.security import get_current_user

from .plan_service import plan_service

plan_router = APIRouter()


@plan_router.get("", response_model=List[PlanDTO])
def list_plans(current_user=Depends(get_current_user)) -> List[PlanDTO]:
    return plan_service.list_plans(current_user)


@plan_router.get("/{plan_id}", response_model=PlanWithAllMessagesDTO)
def get_plan(plan_id: UUID, current_user=Depends(get_current_user)):
    return plan_service.get_plan(plan_id, current_user)


@plan_router.post("", response_model=PlanDTO)
def create_plan(current_user=Depends(get_current_user)):
    return plan_service.create_plan(current_user)


@plan_router.post("/{plan_id}/develop", response_model=PlanDTO)
def develop_plan(
    message: MessageDTO,
    plan_id: UUID,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    plan_dto = plan_service.develop_plan(
        plan_id=plan_id, user=current_user, message=message
    )

    if plan_dto.last_message.content.data.get("ready_to_save", False):
        background_tasks.add_task(
            module_service.generate_modules,
            plan_id,
            current_user,
            plan_dto.last_message.content.data.get("user_observations", None),
        )

    return plan_dto
