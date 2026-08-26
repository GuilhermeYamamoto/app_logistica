"""Router do index (página inicial)."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.auth import OdooCredentials
from app.core.security import get_odoo_credentials
from app.models import ModuleInfo

router = APIRouter(tags=["index"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)

MODULES = [
    ModuleInfo(name="Vendas", model="sale.order", description="Pedidos e cotações"),
    ModuleInfo(name="Compras", model="purchase.order", description="Pedidos a fornecedores"),
    ModuleInfo(name="Inventário", model="stock.picking", description="Transferências e entregas", route="/inventario"),
    ModuleInfo(name="Produtos", model="product.template", description="Catálogo de produtos"),
    ModuleInfo(name="Contatos", model="res.partner", description="Clientes e fornecedores"),
]


@router.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    """Redireciona para o index"""
    return RedirectResponse(url="/index", status_code=303)


@router.get("/index", response_class=HTMLResponse)
async def index(request: Request, credentials: OdooCredentials = Depends(get_odoo_credentials)):
    """Retorna página do index"""
    return templates.TemplateResponse(request=request, name="index/index.html", context={"modules": [m.model_dump() for m in MODULES]})
