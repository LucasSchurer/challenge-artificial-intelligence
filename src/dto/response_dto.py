from pydantic import BaseModel, Field


class ResponseDTO(BaseModel):
    status_code: int = Field(alias="status_code")
    message: str = Field(alias="message")
