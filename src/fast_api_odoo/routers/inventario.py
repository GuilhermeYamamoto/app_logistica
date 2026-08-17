import xmlrpc.client
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from fast_api_odoo.odoo.session import get_odoo_client, get_odoo_credentials

router = APIRouter()
templates = Jinja2Templates(
    directory=Path(__file__).resolve().parents[1] / "frontend" / "templates"
)

INVENTORY_STAGES = [
    {
        "key": "recebimento-fiscal",
        "name": "Recebimento Fiscal",
        "template": "inventario_etapa.html",
    },
    {
        "key": "recebimento-qualidade",
        "name": "Recebimento Qualidade",
        "template": "recebimento_qualidade.html",
    },
    {
        "key": "estoque-transitorio",
        "name": "Estoque Transitório",
        "template": "inventario_etapa.html",
    },
    {
        "key": "pre-separacao",
        "name": "Pré-Separação",
        "template": "inventario_etapa.html",
    },
    {   "key": "separacao", 
        "name": "Separação", 
        "template": "inventario_etapa.html",
    },
    {
        "key": "empacotamento",
        "name": "Empacotamento",
        "template": "inventario_etapa.html",
    },
    {
        "key": "conferencia-expedicao",
        "name": "Conferencia Expedicao",
        "template": "inventario_etapa.html",
    },
    {
        "key": "faturamento",
        "name": "Faturamento",
        "template": "inventario_etapa.html",
    },
    {"key": "entrega", "name": "Entrega", "template": "inventario_etapa.html"},
]
STAGES_BY_KEY = {stage["key"]: stage for stage in INVENTORY_STAGES}


def get_stage(stage_key: str) -> dict[str, str]:
    stage = STAGES_BY_KEY.get(stage_key)
    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa de inventário não disponível.",
        )
    return stage


def redirect_if_not_logged_in(request: Request) -> RedirectResponse | None:
    try:
        get_odoo_credentials(request)
    except HTTPException:
        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    return None


@router.get("/inventario", response_class=HTMLResponse)
async def inventario(request: Request):
    redirect = redirect_if_not_logged_in(request)
    if redirect is not None:
        return redirect

    return templates.TemplateResponse(
        request=request,
        name="inventario.html",
        context={"stages": INVENTORY_STAGES},
    )


@router.get("/inventario/etapas/{stage_key}", response_class=HTMLResponse)
async def etapa_inventario(request: Request, stage_key: str):
    redirect = redirect_if_not_logged_in(request)
    if redirect is not None:
        return redirect

    stage = get_stage(stage_key)
    return templates.TemplateResponse(
        request=request,
        name=stage["template"],
        context={"stage": stage},
    )


@router.get("/api/inventario/etapas/{stage_key}")
async def listar_registros_etapa(request: Request, stage_key: str):
    stage = get_stage(stage_key)
    client = get_odoo_client(request)

    try:
        picking_types = client.execute(
            "stock.picking.type",
            "search_read",
            [("name", "=", stage["name"])],
            fields=["id"],
            limit=1,
        )
        if not picking_types:
            return {
                "stage": stage,
                "records": [],
                "message": "Esta etapa não está configurada no Odoo.",
            }

        records = client.execute(
            "stock.picking",
            "search_read",
            [
                ("picking_type_id", "=", picking_types[0]["id"]),
                ("state", "not in", ["done", "cancel"]),
            ],
            fields=["name", "origin", "state", "partner_id", "scheduled_date"],
            limit=30,
            order="scheduled_date asc",
        )
    except (OSError, xmlrpc.client.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível consultar o Odoo.",
        ) from error

    return {"stage": stage, "records": records}
