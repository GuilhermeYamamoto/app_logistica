"""Utilitários de segurança e autenticação."""

from fastapi import HTTPException, Request, status

from app.config import settings
from app.core.auth import OdooClient, OdooCredentials, session_store


def get_odoo_credentials(request: Request) -> OdooCredentials:
    """Extrai as credenciais do Odoo da sessão do navegador."""
    credentials = session_store.get(request.cookies.get(settings.SESSION_COOKIE_NAME))
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )
    return credentials


def get_odoo_client(request: Request) -> OdooClient:
    """Cria um cliente Odoo autenticado."""
    credentials = get_odoo_credentials(request)
    client = OdooClient(settings.ODOO_URL)
    client.set_authenticated_session(
        db=credentials.db,
        uid=credentials.uid,
        password=credentials.password,
    )
    return client
