import xmlrpc.client
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from fast_api_odoo.odoo.session import get_odoo_client, get_odoo_credentials
from fast_api_odoo.routers.inicio import MODULES

router = APIRouter()
templates = Jinja2Templates(
    directory=Path(__file__).resolve().parents[1] / "frontend" / "templates"
)
MODELS = {module["model"]: module for module in MODULES}


def get_module(model: str) -> dict[str, str]:
    module = MODELS.get(model)
    if module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modelo não disponível.",
        )
    return module


@router.get("/modelos/{model}", response_class=HTMLResponse)
async def modelo(request: Request, model: str):
    if request.cookies.get("odoo_session") is None:
        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)

    get_module(model)
    try:
        get_odoo_credentials(request)
    except HTTPException:
        return RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)

    return templates.TemplateResponse(
        request=request,
        name="modelo.html",
        context={"module": MODELS[model]},
    )


@router.get("/api/modelos/{model}")
async def listar_registros(request: Request, model: str):
    get_module(model)
    client = get_odoo_client(request)

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
