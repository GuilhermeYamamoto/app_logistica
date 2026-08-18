"""Router de autenticação."""

from pathlib import Path

from fastapi import APIRouter, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.exceptions import AuthenticationError, OdooConnectionError
from app.models import LoginRequest
from app.odoo.session import odoo_sessions
from app.services import AuthService

router = APIRouter(tags=["auth"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Retorna página de login."""
    if odoo_sessions.get(request.cookies.get(settings.SESSION_COOKIE_NAME)) is not None:
        return RedirectResponse(url="/dashboard", status_code=status.HTTP_303_SEE_OTHER)

    return templates.TemplateResponse(request=request, name="login.html")


@router.post("/login")
async def login(data: LoginRequest):
    """Realiza login do usuário."""
    try:
        session_token = AuthService.authenticate(data.username, data.password)
    except AuthenticationError:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Usuário ou senha inválidos."},
        )
    except OdooConnectionError as e:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"success": False, "message": str(e)},
        )

    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "message": "Login realizado com sucesso.",
            "redirect": "/dashboard",
        },
    )
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=settings.SESSION_MAX_AGE,
    )
    return response


@router.post("/logout")
async def logout(request: Request):
    """Realiza logout do usuário."""
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    AuthService.logout(token)

    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(settings.SESSION_COOKIE_NAME)
    return response
