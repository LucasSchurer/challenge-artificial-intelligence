from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.tables import Base
from fastapi import HTTPException


class Content(Base):
    __tablename__ = "content"

    module_id: Mapped[UUID] = mapped_column(ForeignKey("module.id"), nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    text_content: Mapped[str] = mapped_column(nullable=True)
    content_type: Mapped[str] = mapped_column(nullable=False)
    order: Mapped[int] = mapped_column(nullable=False, default=0)
    status: Mapped[str] = mapped_column(nullable=False, default="created")

    module: Mapped["Module"] = relationship(  # type: ignore
        "Module", back_populates="contents"
    )

    @classmethod
    def get_by_id(cls, session, id, user_id: UUID = None):
        instance = super().get_by_id(session, id)

        if user_id and instance.module.plan.user_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to access this content."
            )

        return instance
