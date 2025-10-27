from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.tables import Base


class Message(Base):
    __tablename__ = "message"

    chat_id: Mapped[UUID] = mapped_column(ForeignKey("chat.id"), nullable=False)
    text_content: Mapped[str] = mapped_column(nullable=True)
    dict_content: Mapped[dict] = mapped_column(JSONB, nullable=True)
    content_type: Mapped[str] = mapped_column(nullable=False)
    role: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.now(timezone.utc),
        server_default=text("now()"),
        nullable=False,
    )

    chat: Mapped["Chat"] = relationship(  # type: ignore
        "Chat", back_populates="messages"
    )
