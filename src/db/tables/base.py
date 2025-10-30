from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session
from uuid import UUID

from typing import TypeVar, Type

from fastapi import HTTPException

T = TypeVar("T", bound="Base")


class Base(DeclarativeBase):
    __abstract__ = True

    id: Mapped[UUID] = mapped_column(
        primary_key=True, nullable=False, server_default=text("gen_random_uuid()")
    )

    @classmethod
    def get_by_id(cls: Type[T], session: Session, id: UUID) -> T:
        """Get an instance by its ID.

        Args:
            cls (Type[T]): The class of the instance to retrieve.
            session (Session): The database session to use.
            id (UUID): The ID of the instance to retrieve.

        Raises:
            HTTPException: If the instance is not found.

        Returns:
            T: The retrieved instance.
        """
        instance = session.get(cls, id)
        if not instance:
            raise HTTPException(
                status_code=404, detail=f"{cls.__name__} with id {id} not found"
            )

        return instance
