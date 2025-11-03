import os
from datetime import datetime
from typing import List
from uuid import UUID

from src.db import db_connection
from src.db.tables import Agent, Chat, Module, Plan, User
from src.dto import MessageDTO, MessageTextContentDTO, PlanDTO, PlanWithAllMessagesDTO
from src.llm import BedrockHandler


class PlanService:
    def __init__(self):
        self.db_conn = db_connection
        self.handler = BedrockHandler()

        plan_outline_creator_agent_id = os.getenv("PLAN_OUTLINE_CREATOR_AGENT_ID", None)
        if not plan_outline_creator_agent_id:
            raise ValueError(
                "PLAN_OUTLINE_CREATOR_AGENT_ID environment variable is not set."
            )

        with self.db_conn.get_session() as session:
            self.plan_outline_creator_agent = session.get(
                Agent, plan_outline_creator_agent_id
            )
            if not self.plan_outline_creator_agent:
                raise ValueError(
                    f"Agent with ID {plan_outline_creator_agent_id} not found in the database."
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

    def get_plan(self, plan_id: UUID, user: User) -> PlanWithAllMessagesDTO:
        """Get a specific plan with all messages.

        Args:
            plan_id (UUID): The ID of the plan.
            user (User): The currently authenticated user.

        Returns:
            PlanWithAllMessagesDTO: The requested plan with all messages.
        """
        with self.db_conn.get_session() as session:
            plan = Plan.get_by_id(session, plan_id, user.id)

            plan.last_viewed_at = datetime.now()
            session.commit()

            return PlanWithAllMessagesDTO.from_entity(plan)

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
            new_plan.created_at = datetime.now()
            new_plan.last_viewed_at = datetime.now()
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

        Returns:
            PlanDTO: The developed plan.
        """
        with self.db_conn.get_session() as session:
            plan = Plan.get_by_id(session, plan_id, user.id)

            if plan.status == "created":
                return PlanDTO.from_entity(plan)

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


plan_service: PlanService = PlanService()
