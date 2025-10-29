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
)
import os

from src.llm import BedrockHandler
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio


class PlanService:
    def __init__(self):
        self.db_conn = db_connection
        self.handler = BedrockHandler()

        plan_outline_creator_agent_id = os.getenv("PLAN_OUTLINE_CREATOR_AGENT_ID", None)
        if not plan_outline_creator_agent_id:
            raise ValueError(
                "PLAN_OUTLINE_CREATOR_AGENT_ID environment variable is not set."
            )

        module_outline_creator_agent_id = os.getenv(
            "MODULE_OUTLINE_CREATOR_AGENT_ID", None
        )
        if not module_outline_creator_agent_id:
            raise ValueError(
                "MODULE_OUTLINE_CREATOR_AGENT_ID environment variable is not set."
            )

        text_content_creator_agent_id = os.getenv("TEXT_CONTENT_CREATOR_AGENT_ID", None)
        if not text_content_creator_agent_id:
            raise ValueError(
                "TEXT_CONTENT_CREATOR_AGENT_ID environment variable is not set."
            )

        with self.db_conn.get_session() as session:
            self.plan_outline_creator_agent = session.get(
                Agent, plan_outline_creator_agent_id
            )
            if not self.plan_outline_creator_agent:
                raise ValueError(
                    f"Agent with ID {plan_outline_creator_agent_id} not found in the database."
                )
            self.text_content_creator_agent = session.get(
                Agent, text_content_creator_agent_id
            )
            if not self.text_content_creator_agent:
                raise ValueError(
                    f"Agent with ID {text_content_creator_agent_id} not found in the database."
                )
            self.module_outline_creator_agent = session.get(
                Agent, module_outline_creator_agent_id
            )
            if not self.module_outline_creator_agent:
                raise ValueError(
                    f"Agent with ID {module_outline_creator_agent_id} not found in the database."
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
                agent=self.plan_outline_creator_agent,
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
                agent=self.plan_outline_creator_agent,
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

    def __generate_text_content(
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

    def __generate_content(
        self,
        module_id: UUID,
        user_id: UUID,
        content_type: str,
        content_objective: str,
        order: int,
    ) -> Content:
        content_mapping = {
            "text": self.__generate_text_content,
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

    def generate_modules(self, plan_id: UUID, user: User) -> List[ModuleDTO]:
        with self.db_conn.get_session() as session:
            plan = session.get(Plan, plan_id)

            if not plan or plan.user_id != user.id:
                raise HTTPException(status_code=404, detail="Plan not found!")

            modules_ids = [m.id for m in plan.modules]
            plan.status = "creating_modules"
            session.commit()

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(self.generate_module, m, user) for m in modules_ids
            ]
            results = [f.result() for f in futures]

        with self.db_conn.get_session() as session:
            plan = session.get(Plan, plan_id)

            if not plan or plan.user_id != user.id:
                raise HTTPException(status_code=404, detail="Plan not found!")

            plan.status = "created"
            session.commit()

            return ModuleDTO.from_entities(plan.modules)

    def generate_module(self, module_id: UUID, user: User) -> ModuleDTO:
        with self.db_conn.get_session() as session:
            module = session.get(Module, module_id)
            plan = session.get(Plan, module.plan_id)
            module.status = "creating_contents"

            message = MessageDTO(
                user_id=user.id,
                content=MessageTextContentDTO(
                    text=f"User Profile Data: {user.profile_info}\nPlan Title: {plan.title}\nPlan Description: {plan.description}\nModule Title: {module.title}. Module Description: {module.description}"
                ),
                role="user",
            )

            response_message = self.handler.complete(
                session=session,
                message=message,
                user=user,
                agent=self.module_outline_creator_agent,
                model_id="us.anthropic.claude-3-5-sonnet-20240620-v1:0",
            )

            contents = response_message.content.data.get("contents", [])
            session.commit()

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [
                executor.submit(
                    self.__generate_content,
                    module_id,
                    user.id,
                    content.get("type", "text"),
                    content.get("objective", ""),
                    i,
                )
                for i, content in enumerate(contents)
            ]

            results = [f.result() for f in futures]

        with self.db_conn.get_session() as session:
            module = session.get(Module, module_id)
            module.status = "created"
            session.commit()

            return ModuleDTO.from_entity(module)

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

    def get_plan(self, plan_id: UUID, user: User) -> PlanWithAllMessagesDTO:
        """Get a specific plan with all messages.

        Args:
            plan_id (UUID): The ID of the plan.
            user (User): The currently authenticated user.

        Raises:
            HTTPException: If the plan does not exist or does not belong to the user.

        Returns:
            PlanWithAllMessagesDTO: The requested plan with all messages.
        """
        with self.db_conn.get_session() as session:
            plan = session.get(Plan, plan_id)

            if not plan or plan.user_id != user.id:
                raise HTTPException(status_code=404, detail="Plan not found!")

            return PlanWithAllMessagesDTO.from_entity(plan)


plan_service: PlanService = PlanService()
