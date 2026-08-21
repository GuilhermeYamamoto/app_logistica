"""Aplicação FastAPI para integração com Odoo."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import auth, dashboard, inventario, models

app = FastAPI()

# Montar arquivos estáticos
app.mount(
    "/static",
    StaticFiles(directory=settings.STATIC_DIR),
    name="static",
)

# Incluir routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(models.router)
app.include_router(inventario.router)


@app.get("/health")
async def health():
    """Verificar saúde da aplicação."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
