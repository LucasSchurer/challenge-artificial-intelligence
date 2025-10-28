from typing import Dict

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.db.tables import Base


class User(Base):
    __tablename__ = "user"

    name: Mapped[str] = mapped_column(nullable=False)
    username: Mapped[str] = mapped_column(nullable=False, unique=True)
    password: Mapped[str] = mapped_column(nullable=False)
    profile_info: Mapped[Dict] = mapped_column(JSONB, nullable=True, default=None)
