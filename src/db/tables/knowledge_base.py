from sqlalchemy.orm import Mapped, relationship

from src.db.tables import Base


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    documents: Mapped[list["Document"]] = relationship(  # type: ignore
        "Document", back_populates="knowledge_base", cascade="all, delete-orphan"
    )
