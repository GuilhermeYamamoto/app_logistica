"""Router de inventário."""

import xmlrpc.client
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status, Body
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.auth import OdooClient, OdooCredentials
from app.core.security import get_odoo_client, get_odoo_credentials
from app.services.inventory_service import InventoryService
from app.models.schemas import QualityAlert, ReceivedQuantity

router = APIRouter(tags=["inventario"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)

INVENTORY_STAGES = InventoryService.get_inventory_stages()
STAGES_BY_KEY = {stage["key"]: stage for stage in INVENTORY_STAGES}

def get_stage(stage_key: str) -> Dict[str, Any]:
    """Valida e retorna a etapa solicitada."""
    stage = STAGES_BY_KEY.get(stage_key)
    if stage is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etapa de inventário não disponível.")
    return stage


@router.get("/inventario", response_class=HTMLResponse)
async def inventory_page(request: Request, credentials: OdooCredentials = Depends(get_odoo_credentials)):
    """Retorna página principal de inventário."""
    return templates.TemplateResponse(request=request, name="stock_picking/inventario.html", context={"stages": INVENTORY_STAGES})


@router.get("/inventario/{stage_key}", response_class=HTMLResponse)
async def stage_page(
    request: Request,
    stage_key: str,
    client: OdooClient = Depends(get_odoo_client),
):
    """
    Retorna página de uma etapa de inventário.
    -> A página vem do services > inventory_service.py, em que o método get_inventory_stages() retorna as etapas disponíveis, sendo "template" a chave que define o template html.
    """
    stage = get_stage(stage_key)
    records = InventoryService.list_stage_records(client, stage["picking_type_id"])
    return templates.TemplateResponse(request=request, name=stage["template"], context={"stage": stage, "records": records})

@router.post("/api/recebimento-qualidade/{picking_id}/imprimir-etiqueta")
async def imprimir_etiqueta(picking_id: int, client=Depends(get_odoo_client)):
    return await InventoryService.print_report_qualidade(client, picking_id)

@router.post("/api/recebimento-qualidade/pickings/{picking_id}/validar")
async def button_validate(picking_id: int,client=Depends(get_odoo_client)):
    return InventoryService.button_validate(client, picking_id)

@router.get("/api/recebimento-qualidade/pickings")
async def filter_nf(nf_number: str, client=Depends(get_odoo_client)):
    return InventoryService.filter_nf(client, nf_number)

@router.post("/api/quality-alert")
def create_quality_alert(quality_alert_data: QualityAlert = Body(...), client=Depends(get_odoo_client)):
    """
    Cria um alerta de qualidade no Odoo.
    """
    create_quality_alert = InventoryService.create_quality_alert(client, quality_alert_data)
    return {"success": True, "message": "Alerta de qualidade criado com sucesso."}


@router.post("/api/received_quantity")
def received_quantity(
    data: ReceivedQuantity = Body(...), client=Depends(get_odoo_client)):
    """
    Atualiza a quantidade recebida para um picking no Odoo.
    """
    InventoryService.update_received_quantity(client,data)

    return {
        "success": True,
        "message": "Quantidade recebida atualizada com sucesso."
    }
