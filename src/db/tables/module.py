from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.tables import Base


class Module(Base):
    __tablename__ = "module"

    plan_id: Mapped[UUID] = mapped_column(ForeignKey("plan.id"), nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(nullable=True)
    order: Mapped[int] = mapped_column(nullable=False, default=1)
    status: Mapped[str] = mapped_column(nullable=False, default="creating_outline")

    plan: Mapped["Plan"] = relationship(  # type: ignore
        "Plan", back_populates="modules"
    )

    contents: Mapped[list["Content"]] = relationship(  # type: ignore
        "Content", back_populates="module", cascade="all, delete-orphan"
    )
