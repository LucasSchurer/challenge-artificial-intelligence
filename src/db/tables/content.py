from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.tables import Base


class Content(Base):
    __tablename__ = "content"

    module_id: Mapped[UUID] = mapped_column(ForeignKey("module.id"), nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    text_content: Mapped[str] = mapped_column(nullable=True)
    content_type: Mapped[str] = mapped_column(nullable=False)
    order: Mapped[int] = mapped_column(nullable=False, default=0)
    status: Mapped[str] = mapped_column(nullable=False, default="created")
    description: Mapped[str] = mapped_column(nullable=True)
    source_document_id: Mapped[UUID] = mapped_column(
        ForeignKey("document.id"), nullable=True
    )

    module: Mapped["Module"] = relationship(  # type: ignore
        "Module", back_populates="contents"
    )

    source_document: Mapped["Document"] = relationship("Document", uselist=False)  # type: ignore

    @classmethod
    def get_by_id(cls, session, id, user_id: UUID = None):
        instance = super().get_by_id(session, id)

        if user_id and instance.module.plan.user_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to access this content."
            )

        return instance
