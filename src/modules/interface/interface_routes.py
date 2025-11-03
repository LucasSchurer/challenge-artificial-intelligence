from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

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


@interface_router.get("/painel", response_class=HTMLResponse)
async def painel(request: Request):
    return templates.TemplateResponse("painel.html", {"request": request})


@interface_router.get("/plano", response_class=HTMLResponse)
async def plano(request: Request):
    return templates.TemplateResponse("plano.html", {"request": request})


@interface_router.get("/meus-planos", response_class=HTMLResponse)
async def meus_planos(request: Request):
    return templates.TemplateResponse("meus-planos.html", {"request": request})
