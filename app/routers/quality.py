"""Router de recebimento de qualidade."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.security import get_odoo_credentials
from app.odoo.session import OdooCredentials

router = APIRouter(tags=["quality"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)


@router.get("/recebimento-qualidade", response_class=HTMLResponse)
async def quality_page(
    request: Request,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
):
    """Retorna página de recebimento de qualidade."""
    return templates.TemplateResponse(
        request=request,
        name="recebimento_qualidade.html",
    )
