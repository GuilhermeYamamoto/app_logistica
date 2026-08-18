"""Router do dashboard (página inicial)."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.security import get_odoo_credentials
from app.models import ModuleInfo
from app.odoo.session import OdooCredentials

router = APIRouter(tags=["dashboard"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)

MODULES = [
    ModuleInfo(name="Vendas", model="sale.order", description="Pedidos e cotações"),
    ModuleInfo(name="Compras", model="purchase.order", description="Pedidos a fornecedores"),
    ModuleInfo(
        name="Inventário",
        model="stock.picking",
        description="Transferências e entregas",
        route="/inventory",
    ),
    ModuleInfo(name="Produtos", model="product.template", description="Catálogo de produtos"),
    ModuleInfo(name="Contatos", model="res.partner", description="Clientes e fornecedores"),
]


@router.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    """Redireciona para o dashboard."""
    return RedirectResponse(url="/dashboard", status_code=303)


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
):
    """Retorna página do dashboard."""
    return templates.TemplateResponse(
        request=request,
        name="inicio.html",
        context={"modules": [m.model_dump() for m in MODULES]},
    )


@router.get("/inicio", include_in_schema=False)
async def redirect_to_dashboard() -> RedirectResponse:
    """Redireciona /inicio para /dashboard."""
    return RedirectResponse(url="/dashboard", status_code=301)
