import os
from concurrent.futures import ThreadPoolExecutor
from typing import List
from uuid import UUID

from src.db import db_connection
from src.db.tables import Agent, Module, Plan, User
from src.dto import (
    MessageDTO,
    MessageTextContentDTO,
    ModuleDTO,
    ModuleListDTO,
    ResponseDTO,
)
from src.llm import BedrockHandler
from src.modules.content.content_service import content_service


class ModuleService:
    def __init__(self):
        self.db_conn = db_connection
        self.handler = BedrockHandler()

        module_outline_creator_agent_id = os.getenv(
            "MODULE_OUTLINE_CREATOR_AGENT_ID", None
        )
        if not module_outline_creator_agent_id:
            raise ValueError(
                "MODULE_OUTLINE_CREATOR_AGENT_ID environment variable is not set."
            )

        with self.db_conn.get_session() as session:
            self.module_outline_creator_agent = session.get(
                Agent, module_outline_creator_agent_id
            )
            if not self.module_outline_creator_agent:
                raise ValueError(
                    f"Agent with ID {module_outline_creator_agent_id} not found in the database."
                )

    def generate_modules(
        self, plan_id: UUID, user: User, extra_information: str = None
    ) -> List[ModuleDTO]:
        """Generate modules for a plan using AI agent.

        Will generate the modules assynchronously.

        Args:
            plan_id (UUID): The ID of the plan.
            user (User): The currently authenticated user.
            extra_information (str, optional): Any extra information to guide module generation.

        Returns:
            List[ModuleDTO]: List of generated modules.
        """
        with self.db_conn.get_session() as session:
            plan = Plan.get_by_id(session, plan_id, user.id)
            modules_ids = [m.id for m in plan.modules]
            plan.status = "creating_modules"
            session.commit()

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(self.generate_module, m, user, extra_information)
                for m in modules_ids
            ]
            results = [f.result() for f in futures]

        with self.db_conn.get_session() as session:
            plan = Plan.get_by_id(session, plan_id, user.id)
            plan.status = "created"
            session.commit()

            return ModuleDTO.from_entities(plan.modules)

    def generate_module(
        self, module_id: UUID, user: User, extra_information: str = None
    ) -> ModuleDTO:
        """Generate module contents using AI agent.

        Will generate the content assynchronously.

        Args:
            module_id (UUID): The ID of the module.
            user (User): The currently authenticated user.
            extra_information (str, optional): Any extra information to guide content generation.

        Returns:
            ModuleDTO: The generated module data transfer object.
        """
        with self.db_conn.get_session() as session:
            module = Module.get_by_id(session, module_id, user.id)
            module.status = "creating_contents"

            message_text = f"User Profile Data: {user.profile_info}\nPlan Title: {module.plan.title}\nPlan Description: {module.plan.description}\nModule Title: {module.title}. Module Description: {module.description}"
            if extra_information:
                message_text += f"\nExtra Information: {extra_information}"

            message = MessageDTO(
                user_id=user.id,
                content=MessageTextContentDTO(text=message_text),
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
            futures = []
            for i, content in enumerate(contents):
                content_type = content.get("type", None)
                content_objective = content.get("content", None)
                content_title = content.get("title", None)
                if content_type and content_objective:
                    futures.append(
                        executor.submit(
                            content_service.generate_content,
                            module_id,
                            user.id,
                            content_type,
                            content_objective,
                            content_title,
                            i,
                        )
                    )

            results = [f.result() for f in futures]

        with self.db_conn.get_session() as session:
            module = Module.get_by_id(session, module_id, user.id)
            module.status = "created"
            session.commit()

            return ModuleDTO.from_entity(module)

    def list_modules(self, plan_id: UUID, user: User) -> List[ModuleListDTO]:
        """List modules for a plan.

        Args:
            plan_id (UUID): The ID of the plan.
            user (User): The currently authenticated user.

        Returns:
            List[PlanDTO]: The list of modules belonging to the plan.
        """
        with self.db_conn.get_session() as session:
            plan = Plan.get_by_id(session, plan_id, user.id)
            modules = sorted(plan.modules, key=lambda m: m.order)
            return ModuleListDTO.from_entities(modules)

    def get_module(self, module_id: UUID, user: User) -> ModuleDTO:
        """Get a specific module for a plan.

        Args:
            module_id (UUID): The ID of the module.
            user (User): The currently authenticated user.

        Returns:
            ModuleDTO: The requested module.
        """
        with self.db_conn.get_session() as session:
            module = Module.get_by_id(session, module_id, user.id)
            return ModuleDTO.from_entity(module)

    def update_completed_status(
        self, module_id: UUID, user: User, completed: bool
    ) -> ResponseDTO:
        """Update module completion status.

        Args:
            module_id (UUID): The ID of the module.
            user (User): The currently authenticated user.

        Returns:
            ResponseDTO: The response message indicating success.
        """
        with self.db_conn.get_session() as session:
            module = Module.get_by_id(session, module_id, user.id)

            if completed:
                status = "completed"
            else:
                status = "created"

            module.status = status

            for content in module.contents:
                content.status = status

            session.commit()

            return ResponseDTO(
                message=f"Module completion status set to '{status}' successfully.",
                status_code=200,
            )


module_service: ModuleService = ModuleService()
