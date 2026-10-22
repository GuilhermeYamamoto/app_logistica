"""Router de dev."""

import xmlrpc.client
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from app.config import settings, static_asset_version
from app.core.auth import OdooClient, OdooCredentials
from app.core.dev_access import (
    DEV_UNLOCK_COOKIE,
    authenticate_dev_admin,
    create_unlock_token,
    is_dev_unlocked,
    require_dev_admin,
    require_development_environment,
)
from app.core.security import get_odoo_credentials
from app.models.dev import (
    DevSearchReadRequest,
    DevUnlockRequest,
    DevWriteRequest,
    SaleOrderToolRequest,
)
from app.services.dev_service import DevService

router = APIRouter(prefix="/dev", tags=["dev"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)

templates.env.globals["static_asset_version"] = static_asset_version

# Lista das opções disponíveis nas ferramentas de desenvolvimento. As informações de cada etapa são definidas no DevService.
DEV_OPTIONS = DevService.get_dev_options()

# Cria um índice das etapas utilizando a chave como identificador, facilitando a localização de uma etapa através da URL.
OPTION_BY_KEY = {option["key"]: option for option in DEV_OPTIONS}

# Valida a chave recebida pela URL e retorna a configuração correspondente à opção solicitada.
def get_stage(option_key: str) -> Dict[str, Any]:
    """Valida e retorna a etapa solicitada."""
    option = OPTION_BY_KEY.get(option_key)
    if option is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ferramenta de desenvolvimento não disponível.")
    return option

####################################
#  PÁGINA PRINCIPAL DAS FERRAMENTAS DE DESENVOLVIMENTO
####################################
#
#  Exibe a página inicial das ferramentas de desenvolvimento.
#
#  A lista de etapas disponíveis é enviada para o template,
#  permitindo que o usuário selecione a etapa desejada.
#
####################################

@router.get("", response_class=HTMLResponse)
async def dev_page(
    request: Request,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
    _: None = Depends(require_development_environment),
):
    """Retorna a página principal das ferramentas de desenvolvimento."""
    return templates.TemplateResponse(
        request=request,
        name="dev/dev.html",
        context={
            "options": DEV_OPTIONS,
            "dev_unlocked": is_dev_unlocked(request, credentials.uid),
        },
    )


@router.post("/unlock")
async def unlock_dev_tools(
    data: DevUnlockRequest,
    response: Response,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
):
    """Reautentica um administrador e libera a caixa por tempo limitado."""
    require_development_environment()
    authenticate_dev_admin(credentials, data.password)
    response.set_cookie(
        key=DEV_UNLOCK_COOKIE,
        value=create_unlock_token(credentials.uid),
        httponly=True,
        samesite="lax",
        max_age=settings.DEV_UNLOCK_MAX_AGE,
    )
    return {"success": True, "expires_in": settings.DEV_UNLOCK_MAX_AGE}


@router.get("/tools/{toolbox_key}", response_class=HTMLResponse)
async def toolbox_page(
    request: Request,
    toolbox_key: str,
    credentials: OdooCredentials = Depends(require_dev_admin),
):
    """Exibe a lista de ferramentas de uma caixa."""
    toolbox = next((option for option in DEV_OPTIONS if option["key"] == toolbox_key), None)
    if toolbox is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caixa de ferramentas não disponível.",
        )
    return templates.TemplateResponse(
        request=request,
        name="dev/toolbox.html",
        context={
            "toolbox": toolbox,
            "tools": DevService.get_toolbox_tools(toolbox_key),
        },
    )


@router.get("/tools/sale-order/create-sale-order", response_class=HTMLResponse)
async def sale_order_creation_tool_page(
    request: Request,
    credentials: OdooCredentials = Depends(require_dev_admin),
):
    """Exibe a ferramenta de criação de Sale Order."""
    return templates.TemplateResponse(
        request=request,
        name="dev/sale-order-create.html",
        context={"tool_name": "Criar pedido de venda"},
    )


@router.post("/api/tools/sale-order")
async def run_sale_order_tool(
    data: SaleOrderToolRequest,
    credentials: OdooCredentials = Depends(require_dev_admin),
):
    """Simula ou executa a criação de uma Sale Order a partir de um CRM Lead."""
    client = OdooClient(settings.ODOO_URL)
    client.set_authenticated_session(credentials.db, credentials.uid, credentials.password)
    logs: list[str] = []

    try:
        result = DevService.create_sale_order_from_lead(
            client=client,
            lead_id=data.lead_id,
            execute=data.execute,
            log=logs.append,
        )
    except RuntimeError as error:
        logs.append(f"ERRO: {error}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "error": str(error), "logs": logs},
        )
    except (OSError, xmlrpc.client.Error) as error:
        logs.append(f"ERRO RPC: {error}")
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "success": False,
                "error": "O Odoo recusou ou não concluiu a operação RPC.",
                "logs": logs,
            },
        )

    return {"success": True, "result": result, "logs": logs}


@router.get("/api/models/{model}/fields")
async def get_model_fields(
    model: str,
    credentials: OdooCredentials = Depends(require_dev_admin),
):
    """Obtém metadados de campos usando somente fields_get."""
    client = OdooClient(settings.ODOO_URL)
    client.set_authenticated_session(credentials.db, credentials.uid, credentials.password)
    try:
        fields = client.execute(model, "fields_get", [], attributes=["string", "type", "required"])
    except (OSError, xmlrpc.client.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível consultar os campos do modelo.",
        ) from error
    return {"model": model, "fields": fields}


@router.post("/api/search-read")
async def search_read(
    data: DevSearchReadRequest,
    credentials: OdooCredentials = Depends(require_dev_admin),
):
    """Consulta registros sem expor execução de métodos RPC arbitrários."""
    client = OdooClient(settings.ODOO_URL)
    client.set_authenticated_session(credentials.db, credentials.uid, credentials.password)
    try:
        records = client.execute(
            data.model,
            "search_read",
            data.domain,
            fields=data.fields,
            limit=data.limit,
        )
    except (OSError, xmlrpc.client.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível consultar os registros.",
        ) from error
    return {"model": data.model, "records": records}


@router.post("/api/write")
async def write(
    data: DevWriteRequest,
    credentials: OdooCredentials = Depends(require_dev_admin),
):
    """Simula ou executa write; o padrão é sempre dry_run."""
    client = OdooClient(settings.ODOO_URL)
    client.set_authenticated_session(credentials.db, credentials.uid, credentials.password)

    try:
        before = client.read(data.model, data.ids, list(data.values))
        changes = [
            {
                "id": record.get("id"),
                "before": {field: record.get(field) for field in data.values},
                "after": data.values,
            }
            for record in before
        ]

        if data.dry_run:
            return {
                "dry_run": True,
                "model": data.model,
                "ids": data.ids,
                "changes": changes,
            }

        result = client.write(data.model, data.ids, data.values)
    except (OSError, xmlrpc.client.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível executar a alteração.",
        ) from error

    return {
        "dry_run": False,
        "model": data.model,
        "ids": data.ids,
        "updated": result,
        "changes": changes,
    }
