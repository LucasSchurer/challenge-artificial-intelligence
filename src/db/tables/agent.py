from typing import Dict

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.db.tables import Base


class Agent(Base):
    __tablename__ = "agent"

    label: Mapped[str] = mapped_column(nullable=False)
    system_prompt: Mapped[str] = mapped_column(nullable=False)
    output_format: Mapped[Dict] = mapped_column(JSONB, nullable=True, default=None)
