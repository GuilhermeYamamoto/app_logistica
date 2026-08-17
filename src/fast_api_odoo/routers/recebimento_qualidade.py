from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from fast_api_odoo.odoo.rpc import OdooRPC
from pydantic import BaseModel

router = APIRouter()

templates = Jinja2Templates(
    directory=Path(__file__).resolve().parents[1] / "frontend" / "templates"
)

@router.get("/recebimento_qualidade", response_class=HTMLResponse)
async def login(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="recebimento_qualidade.html",
    )
