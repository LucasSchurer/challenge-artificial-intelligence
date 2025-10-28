from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

templates = Jinja2Templates(directory="src/templates")
interface_router = APIRouter()


@interface_router.get("", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@interface_router.get("/chat", response_class=HTMLResponse)
async def chat(request: Request):
    return templates.TemplateResponse("chat.html", {"request": request})


@interface_router.get("/perfil", response_class=HTMLResponse)
async def perfil(request: Request):
    return templates.TemplateResponse("perfil.html", {"request": request})


@interface_router.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@interface_router.get("/registro", response_class=HTMLResponse)
async def registro(request: Request):
    return templates.TemplateResponse("registro.html", {"request": request})


@interface_router.get("/avaliacao", response_class=HTMLResponse)
async def avaliacao(request: Request):
    return templates.TemplateResponse("avaliacao.html", {"request": request})


@interface_router.get("/biblioteca", response_class=HTMLResponse)
async def biblioteca(request: Request):
    return templates.TemplateResponse("biblioteca.html", {"request": request})