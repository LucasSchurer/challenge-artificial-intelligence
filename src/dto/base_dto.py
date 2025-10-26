from typing import List, Type, TypeVar

from pydantic import BaseModel

from src.db.tables import Base

T = TypeVar("T", bound="BaseDTO")
Entity = TypeVar("Entity", bound=Base)


class BaseDTO(BaseModel):
    class Config:
        from_attributes = True
        populate_by_name = True

    @classmethod
    def from_entity(cls: Type[T], entity: Base):
        dto = cls.model_validate(entity)
        return dto

    @classmethod
    def from_entities(cls: Type[T], entities: List[Base]):
        return [cls.from_entity(entity) for entity in entities]
