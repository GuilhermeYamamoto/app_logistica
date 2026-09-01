"""Aplicação FastAPI para integração com Odoo."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import auth, index, stock_picking, models

app = FastAPI()

# Montar arquivos estáticos
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")

# Incluir routers
app.include_router(auth.router)
app.include_router(index.router)
app.include_router(stock_picking.router)
app.include_router(models.router)


@app.get("/health")
async def health():
    """Verificar saúde da aplicação."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
