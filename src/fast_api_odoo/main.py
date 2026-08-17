from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from fast_api_odoo.routers.inicio import router as inicio_router
from fast_api_odoo.routers.inventario import router as inventario_router
from fast_api_odoo.routers.recebimento_qualidade import router as recebimento_qualidade_router
from fast_api_odoo.routers.login import router as login_router
from fast_api_odoo.routers.modelos import router as modelos_router

app = FastAPI()
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"

app.mount(
    "/static",
    StaticFiles(directory=FRONTEND_DIR / "static"),
    name="static",
)

app.include_router(login_router)
app.include_router(inicio_router)
app.include_router(modelos_router)
app.include_router(inventario_router)
app.include_router(recebimento_qualidade_router)
