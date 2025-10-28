from datetime import datetime, timezone
from uuid import UUID

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

    modules: Mapped[list["Module"]] = relationship(  # type: ignore
        "Module", back_populates="plan", cascade="all, delete-orphan"
    )

    user: Mapped["User"] = relationship("User", back_populates="plans")  # type: ignore
    chat: Mapped["Chat"] = relationship("Chat", back_populates="plans", uselist=False)  # type: ignore
