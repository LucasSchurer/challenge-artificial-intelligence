from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.tables import Base


class Plan(Base):
    __tablename__ = "plan"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    chat_id: Mapped[UUID] = mapped_column(ForeignKey("chat.id"), nullable=True)
    title: Mapped[str] = mapped_column(nullable=False, default="New Plan")
    description: Mapped[str] = mapped_column(nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.now(timezone.utc),
        server_default=text("now()"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(nullable=False, default="creating_outline")

    modules: Mapped[list["Module"]] = relationship(  # type: ignore
        "Module", back_populates="plan", cascade="all, delete-orphan"
    )

    user: Mapped["User"] = relationship("User", back_populates="plans")  # type: ignore
    chat: Mapped["Chat"] = relationship("Chat", back_populates="plans", uselist=False)  # type: ignore

    @classmethod
    def get_by_id(cls, session, id, user_id: UUID = None):
        instance = super().get_by_id(session, id)

        if user_id and instance.user_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to access this plan."
            )

        return instance
