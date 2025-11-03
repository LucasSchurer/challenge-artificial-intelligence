from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import BYTEA
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.tables import Base


class Document(Base):
    __tablename__ = "document"

    knowledge_base_id: Mapped[UUID] = mapped_column(
        ForeignKey("knowledge_base.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    document_type: Mapped[str] = mapped_column(nullable=False)
    document_extension: Mapped[str] = mapped_column(nullable=False)
    data: Mapped[bytes] = mapped_column(BYTEA, nullable=False)

    knowledge_base: Mapped["KnowledgeBase"] = relationship(  # type: ignore
        "KnowledgeBase", back_populates="documents"
    )
    chunks: Mapped[list["Chunk"]] = relationship(  # type: ignore
        "Chunk", back_populates="document", cascade="all, delete-orphan"
    )

    contents: Mapped[list["Content"]] = relationship(  # type: ignore
        "Content", back_populates="source_document", cascade="all, delete-orphan"
    )
