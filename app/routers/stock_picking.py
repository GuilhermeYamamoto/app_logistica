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
from app.models.schemas import (QualityAlert, ReceivedQuantity, SavePickingPhotos,)

router = APIRouter(tags=["inventario"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)

# Lista das etapas disponíveis no fluxo de inventário.
# As informações de cada etapa são definidas no InventoryService.
INVENTORY_STAGES = InventoryService.get_inventory_stages()

# Cria um índice das etapas utilizando a chave como identificador,
# facilitando a localização de uma etapa através da URL.
STAGES_BY_KEY = {stage["key"]: stage for stage in INVENTORY_STAGES}


# Valida a chave recebida pela URL e retorna a configuração
# correspondente à etapa solicitada.

def get_stage(stage_key: str) -> Dict[str, Any]:
    """Valida e retorna a etapa solicitada."""
    stage = STAGES_BY_KEY.get(stage_key)
    if stage is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etapa de inventário não disponível.")
    return stage



####################################
#  PÁGINA PRINCIPAL DO INVENTÁRIO
####################################
#
#  Exibe a página inicial do módulo de inventário.
#
#  A lista de etapas disponíveis é enviada para o template,
#  permitindo que o usuário selecione a etapa desejada.
#
####################################

@router.get("/inventario", response_class=HTMLResponse)
async def inventory_page(request: Request, credentials: OdooCredentials = Depends(get_odoo_credentials)):
    """Retorna página principal de inventário."""
    return templates.TemplateResponse(request=request, name="stock_picking/inventario.html", context={"stages": INVENTORY_STAGES})



####################################
#  PÁGINA DE UMA ETAPA DO INVENTÁRIO
####################################
#
#  Exibe a página correspondente à etapa informada na URL.
#
#  O stage_key identifica a etapa e é utilizado para obter sua
#  configuração. A configuração define o tipo de picking utilizado
#  no Odoo e o template HTML que deverá ser carregado.
#
#  Antes de renderizar a página, os registros da etapa são consultados
#  no InventoryService.
#
####################################

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



####################################
#  IMPRESSÃO DA ETIQUETA
####################################
#
#  Solicita a impressão da etiqueta de um recebimento.
#
#  O picking_id identifica o recebimento no Odoo. A operação de
#  impressão é delegada ao InventoryService, que realiza a comunicação
#  necessária com o Odoo e o dispositivo de impressão.
#
####################################

@router.post("/api/recebimento-qualidade/{picking_id}/imprimir-etiqueta")
async def imprimir_etiqueta(picking_id: int, client=Depends(get_odoo_client)):
    return await InventoryService.print_report_qualidade(client, picking_id)



####################################
#  VALIDAÇÃO DO PICKING
####################################
#
#  Valida um picking de recebimento no Odoo.
#
#  O picking_id identifica o picking que será validado. A execução
#  da validação é realizada pelo InventoryService.
#
####################################

@router.post("/api/recebimento-qualidade/pickings/{picking_id}/validar")
async def button_validate(picking_id: int,client=Depends(get_odoo_client)):
    return InventoryService.button_validate(client, picking_id)



####################################
#  CONSULTA DE PICKINGS POR NOTA FISCAL
####################################
#
#  Busca os pickings de recebimento no Odoo utilizando o número
#  da nota fiscal informado como filtro.
#
#  O resultado da consulta é retornado pelo InventoryService.
#
####################################

@router.get("/api/recebimento-qualidade/pickings")
async def filter_nf(nf_number: str, client=Depends(get_odoo_client)):
    return InventoryService.filter_nf(client, nf_number)



####################################
#  LISTAGEM DAS CAUSAS DE NÃO CONFORMIDADE
####################################
#
#  Retorna as causas de não conformidade disponíveis no Odoo.
#
#  Essas informações são utilizadas durante o processo de criação
#  de um alerta de qualidade.
#
####################################

@router.get("/api/quality-alert/causas")
def list_quality_causes(client=Depends(get_odoo_client)):
    """
    Retorna as causas de não conformidade disponíveis no Odoo.
    """

    return InventoryService.list_quality_causes(client)



####################################
#  CRIAÇÃO DE ALERTA DE QUALIDADE
####################################
#
#  Cria um novo alerta de qualidade no Odoo.
#
#  Os dados enviados na requisição são recebidos através do schema
#  QualityAlert e encaminhados ao InventoryService para criação
#  do registro no Odoo.
#
####################################

@router.post("/api/quality-alert")
def create_quality_alert(quality_alert_data: QualityAlert = Body(...), client=Depends(get_odoo_client)):
    """
    Cria um alerta de qualidade no Odoo.
    """
    create_quality_alert = InventoryService.create_quality_alert(client, quality_alert_data)
    return {"success": True, "message": "Alerta de qualidade criado com sucesso."}



####################################
#  ATUALIZAÇÃO DA QUANTIDADE RECEBIDA
####################################
#
#  Atualiza a quantidade efetivamente recebida de um picking no Odoo.
#
#  Os dados recebidos são validados através do schema
#  ReceivedQuantity e enviados ao InventoryService, que realiza
#  a atualização no Odoo.
#
####################################

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



####################################
#  REGISTRO DAS FOTOS DO PICKING
####################################
#
#  Recebe as fotos capturadas pelo frontend e envia ao Odoo.
#
#  As imagens somente são persistidas quando o usuário confirma
#  o registro das fotos.
#
####################################

@router.post("/api/recebimento-qualidade/pickings/photos")
def save_picking_photos(
    data: SavePickingPhotos = Body(...),
    client=Depends(get_odoo_client),
):
    """
    Registra as fotos de um picking no Odoo.
    """

    return InventoryService.save_picking_photos(
        client,
        data,
    )
