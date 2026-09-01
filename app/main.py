"""Aplicação FastAPI para integração com Odoo."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, index, stock_picking, models

app = FastAPI()

# Configurar CORS para permitir requisições da app Android e web
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especifique os domínios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/api/test")
async def test_endpoint():
    """Endpoint de teste sem autenticação - útil para debug."""
    return {
        "status": "ok",
        "message": "Servidor respondendo corretamente!",
        "cors": "Habilitado",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
