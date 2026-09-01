"""Rotas relacionadas ao fluxo de inventário."""

from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.auth import OdooClient, OdooCredentials
from app.core.security import get_odoo_client, get_odoo_credentials
from app.models.schemas import QualityAlert, ReceivedQuantity
from app.services.inventory_service import InventoryService


router = APIRouter(tags=["inventario"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)


# Etapas disponíveis no fluxo de inventário.
# A configuração é centralizada no InventoryService.
INVENTORY_STAGES = InventoryService.get_inventory_stages()

# Índice das etapas por chave para facilitar a validação e localização
# da etapa solicitada através da URL.
STAGES_BY_KEY = {
    stage["key"]: stage
    for stage in INVENTORY_STAGES
}


def get_stage(stage_key: str) -> Dict[str, Any]:
    """Valida e retorna a configuração da etapa solicitada."""
    stage = STAGES_BY_KEY.get(stage_key)

    if stage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Etapa de inventário não disponível.",
        )

    return stage


####################################
#  PÁGINA PRINCIPAL DO INVENTÁRIO
####################################
#
#  Exibe a página inicial do módulo de inventário.
#  O template recebe a lista de etapas disponíveis para que o usuário
#  possa selecionar o fluxo desejado.
#
####################################

@router.get("/inventario", response_class=HTMLResponse)
async def inventory_page(
    request: Request,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
):
    """Exibe a página principal do inventário."""
    return templates.TemplateResponse(
        request=request,
        name="stock_picking/inventario.html",
        context={"stages": INVENTORY_STAGES},
    )



####################################
#  PÁGINA DE UMA ETAPA DO INVENTÁRIO
####################################
#
#  Exibe a página correspondente a uma etapa específica do inventário.
#
#  A chave da etapa é recebida pela URL e utilizada para localizar sua
#  configuração. Com essa configuração, o sistema identifica:
#  - O tipo de picking utilizado no Odoo.
#  - O template HTML que deve ser renderizado.
#  - Os registros que devem ser exibidos na página.
#
####################################

@router.get("/inventario/{stage_key}", response_class=HTMLResponse)
async def stage_page(
    request: Request,
    stage_key: str,
    client: OdooClient = Depends(get_odoo_client),
):
    """Exibe a página correspondente a uma etapa do inventário."""
    stage = get_stage(stage_key)

    records = InventoryService.list_stage_records(
        client,
        stage["picking_type_id"],
    )

    return templates.TemplateResponse(
        request=request,
        name=stage["template"],
        context={
            "stage": stage,
            "records": records,
        },
    )



####################################
#  IMPRESSÃO DA ETIQUETA
####################################
#
#  Solicita a impressão da etiqueta relacionada a um recebimento.
#
#  O picking_id identifica o recebimento no Odoo e é enviado ao
#  InventoryService, que executa a operação de impressão.
#
####################################

@router.post("/api/recebimento-qualidade/{picking_id}/imprimir-etiqueta")
async def imprimir_etiqueta(
    picking_id: int,
    client=Depends(get_odoo_client),
):
    """Solicita a impressão da etiqueta do recebimento."""
    return await InventoryService.print_report_qualidade(
        client,
        picking_id,
    )



####################################
#  VALIDAÇÃO DO PICKING
####################################
#
#  Valida um picking de recebimento no Odoo.
#
#  O picking_id identifica a operação que será validada.
#  A regra de validação fica concentrada no InventoryService.
#
####################################

@router.post("/api/recebimento-qualidade/pickings/{picking_id}/validar")
async def button_validate(
    picking_id: int,
    client=Depends(get_odoo_client),
):
    """Valida o picking de recebimento no Odoo."""
    return InventoryService.button_validate(
        client,
        picking_id,
    )



####################################
#  CONSULTA DE PICKINGS POR NOTA FISCAL
####################################
#
#  Consulta os pickings de recebimento utilizando o número da nota
#  fiscal informado pelo usuário.
#
#  O resultado da busca é obtido através do InventoryService,
#  que realiza a consulta no Odoo.
#
####################################

@router.get("/api/recebimento-qualidade/pickings")
async def filter_nf(
    nf_number: str,
    client=Depends(get_odoo_client),
):
    """Busca pickings de recebimento pelo número da nota fiscal."""
    return InventoryService.filter_nf(
        client,
        nf_number,
    )



####################################
#  LISTAGEM DAS CAUSAS DE QUALIDADE
####################################
#
#  Retorna as causas de não conformidade cadastradas no Odoo.
#
#  Essas causas são utilizadas no processo de criação de um
#  alerta de qualidade.
#
####################################
@router.get("/api/quality-alert/causas")
def list_quality_causes(
    client=Depends(get_odoo_client),
):
    """Lista as causas de não conformidade cadastradas no Odoo."""
    return InventoryService.list_quality_causes(client)



####################################
#  CRIAÇÃO DE ALERTA DE QUALIDADE
####################################
#
#  Cria um novo alerta de qualidade no Odoo.
#
#  Os dados recebidos no corpo da requisição são validados pelo
#  schema QualityAlert antes de serem enviados ao InventoryService.
#
####################################

@router.post("/api/quality-alert")
def create_quality_alert(
    quality_alert_data: QualityAlert = Body(...),
    client=Depends(get_odoo_client),
):
    """Cria um novo alerta de qualidade no Odoo."""
    InventoryService.create_quality_alert(
        client,
        quality_alert_data,
    )

    return {
        "success": True,
        "message": "Alerta de qualidade criado com sucesso.",
    }



####################################
#  ATUALIZAÇÃO DA QUANTIDADE RECEBIDA
####################################
#
#  Atualiza no Odoo a quantidade efetivamente recebida em um picking.
#
#  Os dados enviados pelo frontend são validados pelo schema
#  ReceivedQuantity e encaminhados ao InventoryService.
#
####################################

@router.post("/api/received_quantity")
def received_quantity(
    data: ReceivedQuantity = Body(...),
    client=Depends(get_odoo_client),
):
    """Atualiza a quantidade recebida do picking no Odoo."""
    InventoryService.update_received_quantity(
        client,
        data,
    )

    return {
        "success": True,
        "message": "Quantidade recebida atualizada com sucesso.",
    }