from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.tables import Base


class Content(Base):
    __tablename__ = "content"

    module_id: Mapped[UUID] = mapped_column(ForeignKey("module.id"), nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    text_content: Mapped[str] = mapped_column(nullable=True)
    content_type: Mapped[str] = mapped_column(nullable=False)
    order: Mapped[int] = mapped_column(nullable=False, default=0)

    module: Mapped["Module"] = relationship(  # type: ignore
        "Module", back_populates="contents"
    )
