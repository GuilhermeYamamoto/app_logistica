"""Router de inventário."""

import xmlrpc.client
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.auth import OdooAuthService, OdooCredentials
from app.core.security import get_odoo_client, get_odoo_credentials

router = APIRouter(tags=["inventario"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)

INVENTORY_STAGES = OdooAuthService.get_inventory_stages()
STAGES_BY_KEY = {stage["key"]: stage for stage in INVENTORY_STAGES}


def get_stage(stage_key: str) -> Dict[str, str]:
    """Valida e retorna a etapa solicitada."""
    stage = STAGES_BY_KEY.get(stage_key)
    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa de inventário não disponível.",
        )
    return stage


@router.get("/inventario", response_class=HTMLResponse)
async def inventory_page(
    request: Request,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
):
    """Retorna página principal de inventário."""
    return templates.TemplateResponse(
        request=request,
        name="inventario.html",
        context={"stages": INVENTORY_STAGES},
    )


@router.get("/inventario/etapas/{stage_key}", response_class=HTMLResponse)
async def stage_page(
    request: Request,
    stage_key: str,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
):
    """Retorna página de uma etapa de inventário."""
    stage = get_stage(stage_key)
    return templates.TemplateResponse(
        request=request,
        name=stage["template"],
        context={"stage": stage},
    )


@router.get("/api/inventario/etapas/{stage_key}")
async def list_stage_records(
    request: Request,
    stage_key: str,
    client=Depends(get_odoo_client),
):
    """Lista registros de uma etapa de inventário."""
    stage = get_stage(stage_key)

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
