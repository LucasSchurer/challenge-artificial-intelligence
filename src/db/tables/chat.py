from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.tables import Base


class Chat(Base):
    __tablename__ = "chat"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("user.id"), nullable=False)
    label: Mapped[str] = mapped_column(nullable=False, default="New Chat")
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.now(timezone.utc),
        server_default=text("now()"),
        nullable=False,
    )

    messages: Mapped[list["Message"]] = relationship(  # type: ignore
        "Message", back_populates="chat", cascade="all, delete-orphan"
    )
