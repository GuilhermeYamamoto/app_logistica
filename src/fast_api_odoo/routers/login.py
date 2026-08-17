import xmlrpc.client
from pathlib import Path

from fastapi import APIRouter, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from fast_api_odoo.odoo.rpc import AuthenticationError, OdooRPC
from fast_api_odoo.odoo.session import (
    ODOO_DB,
    ODOO_URL,
    SESSION_COOKIE_NAME,
    OdooCredentials,
    odoo_sessions,
)

router = APIRouter()
templates = Jinja2Templates(
    directory=Path(__file__).resolve().parents[1] / "frontend" / "templates"
)


class LoginRequest(BaseModel):
    username: str
    password: str


@router.get("/login", response_class=HTMLResponse)
async def login(request: Request):
    if odoo_sessions.get(request.cookies.get(SESSION_COOKIE_NAME)) is not None:
        return RedirectResponse(url="/inicio", status_code=status.HTTP_303_SEE_OTHER)

    return templates.TemplateResponse(request=request, name="login.html")


@router.post("/login")
async def fazer_login(data: LoginRequest):
    try:
        client = OdooRPC(ODOO_URL)
        uid = client.authenticate(db=ODOO_DB, username=data.username, password=data.password)
    except AuthenticationError:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Usuário ou senha inválidos."},
        )
    except (OSError, xmlrpc.client.Error):
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "success": False,
                "message": "Não foi possível conectar ao Odoo. Tente novamente.",
            },
        )

    session_token = odoo_sessions.create(
        OdooCredentials(
            db=ODOO_DB,
            username=data.username,
            password=data.password,
            uid=uid,
        )
    )
    response = JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": True,
            "message": "Login realizado com sucesso.",
            "redirect": "/inicio",
        },
    )
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 8,
    )
    return response


@router.post("/logout")
async def logout(request: Request):
    odoo_sessions.delete(request.cookies.get(SESSION_COOKIE_NAME))
    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return response
