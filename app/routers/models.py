"""Router de modelos Odoo."""

import xmlrpc.client
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.auth import OdooCredentials
from app.core.security import get_odoo_client, get_odoo_credentials
from app.models import ModuleInfo
from app.routers.dashboard import MODULES

router = APIRouter(tags=["models"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)

MODELS_DICT = {m.model: m.model_dump() for m in MODULES}


def get_module(model: str) -> Dict[str, Any]:
    """Valida e retorna o módulo solicitado."""
    module = MODELS_DICT.get(model)
    if module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo não disponível.",
        )
    return module


@router.get("/modelos/{model}", response_class=HTMLResponse)
async def model_page(
    request: Request,
    model: str,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
):
    """Retorna página de um modelo."""
    module = get_module(model)
    return templates.TemplateResponse(
        request=request,
        name="modelo.html",
        context={"module": module},
    )


@router.get("/api/modelos/{model}")
async def list_records(
    request: Request,
    model: str,
    client=Depends(get_odoo_client),
):
    """Lista registros de um modelo."""
    module = get_module(model)

    try:
        records = client.execute(
            model,
            "search_read",
            [],
            fields=["display_name"],
            limit=30,
        )
    except (OSError, xmlrpc.client.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível consultar o Odoo.",
        ) from error

    return {"model": model, "records": records}
