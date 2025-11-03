from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.modules import (
    chat_router,
    content_router,
    interface_router,
    knowledge_base_router,
    module_router,
    plan_router,
    user_router,
)


def create_app():
    load_dotenv(override=True)
    app = FastAPI(title="Grupo A Desafio", version="1.0.0")

    app.include_router(interface_router, prefix="/ui")
    app.include_router(user_router, prefix="/user", tags=["User"])
    app.include_router(plan_router, prefix="/plan", tags=["Plan"])
    app.include_router(module_router, prefix="/plan/{plan_id}/modules", tags=["Module"])
    app.include_router(
        content_router,
        prefix="/plan/{plan_id}/modules/{module_id}/contents",
        tags=["Content"],
    )
    app.include_router(chat_router, prefix="/chat", tags=["Chat"])
    app.include_router(
        knowledge_base_router, prefix="/knowledge_base", tags=["Knowledge Base"]
    )

    app.mount("/static", StaticFiles(directory="src/static"), name="static")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app


app = create_app()
