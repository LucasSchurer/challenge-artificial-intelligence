from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.modules import chat_router, interface_router, user_router, plan_router


def create_app():
    load_dotenv(override=True)
    app = FastAPI(title="Grupo A Desafio", version="1.0.0")

    app.include_router(interface_router, prefix="/ui")
    app.include_router(user_router, prefix="/user", tags=["User"])
    app.include_router(plan_router, prefix="/plan", tags=["Plan"])
    app.include_router(chat_router, prefix="/chat", tags=["Chat"])

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
