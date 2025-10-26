from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from uuid import UUID


class Base(DeclarativeBase):
    __abstract__ = True

    id: Mapped[UUID] = mapped_column(
        primary_key=True, nullable=False, server_default=text("gen_random_uuid()")
    )
