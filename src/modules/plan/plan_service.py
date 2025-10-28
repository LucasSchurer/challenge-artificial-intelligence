import json
from typing import List
from uuid import UUID

import boto3
from fastapi import HTTPException
from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
from sqlalchemy.orm import Session

from src.db import db_connection
from src.db.tables import Chat, Message, User, Agent, Plan, Module
from src.dto import (
    PlanCreateDTO,
    PlanDTO,
    ModuleListDTO,
    ContentDTO,
    MessageDTO,
    MessageTextContentDTO,
    ModuleDTO,
)
import os

from src.llm import BedrockHandler


class PlanService:
    def __init__(self):
        self.db_conn = db_connection
        self.handler = BedrockHandler()

        outline_creator_agent_id = os.getenv("PLAN_OUTLINE_CREATOR_AGENT_ID", None)
        if not outline_creator_agent_id:
            raise ValueError(
                "PLAN_OUTLINE_CREATOR_AGENT_ID environment variable is not set."
            )

        with self.db_conn.get_session() as session:
            self.outline_creator_agent = session.get(Agent, outline_creator_agent_id)
            if not self.outline_creator_agent:
                raise ValueError(
                    f"Agent with ID {outline_creator_agent_id} not found in the database."
                )

    def list_plans(self, user: User) -> List[PlanDTO]:
        """List plans for a user.

        Args:
            user (User): The currently authenticated user.

        Returns:
            List[PlanDTO]: The list of plans belonging to the user.
        """
        with self.db_conn.get_session() as session:
            plans = session.query(Plan).filter(Plan.user_id == user.id).all()
            return PlanDTO.from_entities(plans)

    def create_plan(self, user: User) -> PlanDTO:
        """Create a new plan for a user.

        Args:
            user (User): The currently authenticated user.

        Returns:
            PlanDTO: The newly created plan.
        """
        with self.db_conn.get_session() as session:
            new_chat = Chat(user_id=user.id)

            session.add(new_chat)
            session.flush()

            new_plan = Plan(user_id=user.id, chat_id=new_chat.id)
            session.add(new_plan)

            response_message = self.handler.complete(
                session=session,
                message=MessageDTO(
                    chat_id=new_chat.id,
                    user_id=user.id,
                    content=MessageTextContentDTO(
                        text=f"User Profile Data: {user.profile_info}."
                    ),
                    role="user",
                ),
                user=user,
                agent=self.outline_creator_agent,
                model_id="us.anthropic.claude-3-5-sonnet-20240620-v1:0",
            )

            session.commit()

            return PlanDTO.from_entity(new_plan)

    def develop_plan(self, plan_id: UUID, user: User, message: MessageDTO) -> PlanDTO:
        """Develop a plan using an AI agent.

        Args:
            plan_id (UUID): The ID of the plan to develop.
            user (User): The currently authenticated user.

        Raises:
            HTTPException: If the plan does not exist or does not belong to the user.

        Returns:
            PlanDTO: The developed plan.
        """
        with self.db_conn.get_session() as session:
            plan = session.get(Plan, plan_id)

            if not plan or plan.user_id != user.id:
                raise HTTPException(status_code=404, detail="Plan not found!")

            message.chat_id = plan.chat_id

            response_message = self.handler.complete(
                session=session,
                message=message,
                user=user,
                agent=self.outline_creator_agent,
                model_id="us.anthropic.claude-3-5-sonnet-20240620-v1:0",
            )

            if response_message.content.data.get("ready_to_save", False):
                plan.title = (
                    response_message.content.data.get("title", None) or plan.title
                )

                plan.description = (
                    response_message.content.data.get("description", None)
                ) or plan.description

                modules = response_message.content.data.get("modules", [])

                for module in plan.modules:
                    session.delete(module)

                session.flush()

                for i, module in enumerate(modules):
                    module_db = Module(
                        plan_id=plan.id,
                        title=module.get("title", "Untitled Module"),
                        description=module.get("description", ""),
                        order=i,
                    )

                    session.add(module_db)
                    session.flush()

            session.commit()
            return PlanDTO.from_entity(plan)

    def list_modules(self, plan_id: UUID, user: User) -> List[ModuleListDTO]:
        """List modules for a plan.

        Args:
            plan_id (UUID): The ID of the plan.
            user (User): The currently authenticated user.

        Raises:
            HTTPException: If the plan does not exist or does not belong to the user.

        Returns:
            List[PlanDTO]: The list of modules belonging to the plan.
        """
        with self.db_conn.get_session() as session:
            plan = session.get(Plan, plan_id)

            if not plan or plan.user_id != user.id:
                raise HTTPException(status_code=404, detail="Plan not found!")

            modules = sorted(plan.modules, key=lambda m: m.order)
            return ModuleListDTO.from_entities(modules)

    def get_module(self, plan_id: UUID, module_id: UUID, user: User) -> ModuleDTO:
        """Get a specific module for a plan.

        Args:
            plan_id (UUID): The ID of the plan.
            module_id (UUID): The ID of the module.
            user (User): The currently authenticated user.

        Raises:
            HTTPException: If the plan or module does not exist or does not belong to the user.

        Returns:
            ModuleDTO: The requested module.
        """
        with self.db_conn.get_session() as session:
            plan = session.get(Plan, plan_id)

            if not plan or plan.user_id != user.id:
                raise HTTPException(status_code=404, detail="Plan not found!")

            module = session.get(Module, module_id)

            if not module or module.plan_id != plan.id:
                raise HTTPException(status_code=404, detail="Module not found!")

            return ModuleDTO.from_entity(module)


plan_service: PlanService = PlanService()
