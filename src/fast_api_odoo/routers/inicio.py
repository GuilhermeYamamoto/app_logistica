from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from fast_api_odoo.odoo.session import odoo_sessions

router = APIRouter()
templates = Jinja2Templates(
    directory=Path(__file__).resolve().parents[1] / "frontend" / "templates"
)

MODULES = [
    {"name": "Vendas", "model": "sale.order", "description": "Pedidos e cotações"},
    {"name": "Compras", "model": "purchase.order", "description": "Pedidos a fornecedores"},
    {
        "name": "Inventário",
        "model": "stock.picking",
        "description": "Transferências e entregas",
        "route": "/inventario",
    },
    {"name": "Produtos", "model": "product.template", "description": "Catálogo de produtos"},
    {"name": "Contatos", "model": "res.partner", "description": "Clientes e fornecedores"},
]


@router.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/inicio", status_code=303)


@router.get("/inicio", response_class=HTMLResponse)
async def inicio(request: Request):
    if odoo_sessions.get(request.cookies.get("odoo_session")) is None:
        return RedirectResponse(url="/login", status_code=303)

    return templates.TemplateResponse(
        request=request,
        name="inicio.html",
        context={"modules": MODULES},
    )
