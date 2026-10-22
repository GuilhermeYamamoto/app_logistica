"""Controle de acesso isolado para as ferramentas de desenvolvimento."""

import base64
import hashlib
import hmac
import time
from typing import Optional

from fastapi import HTTPException, Request, status

from app.config import settings
from app.core.auth import OdooClient, OdooCredentials
from app.core.exceptions import AuthenticationError
from app.core.security import get_odoo_credentials

DEV_UNLOCK_COOKIE = "dev_unlock"


def require_development_environment() -> None:
    """Impede o uso das ferramentas fora do ambiente de desenvolvimento."""
    if settings.ENVIRONMENT.lower() != "development":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurso não encontrado.",
        )


def _signature(uid: int, expires_at: int) -> str:
    payload = f"{uid}:{expires_at}".encode()
    return hmac.new(
        settings.DEV_UNLOCK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()


def create_unlock_token(uid: int) -> str:
    """Cria um token assinado e temporário para a caixa de ferramentas."""
    expires_at = int(time.time()) + settings.DEV_UNLOCK_MAX_AGE
    signature = _signature(uid, expires_at)
    value = f"{uid}:{expires_at}:{signature}".encode()
    return base64.urlsafe_b64encode(value).decode()


def _is_valid_unlock_token(token: Optional[str], uid: int) -> bool:
    if not token:
        return False

    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        token_uid, expires_at_text, signature = decoded.split(":", 2)
        expires_at = int(expires_at_text)
    except (ValueError, UnicodeDecodeError):
        return False

    try:
        token_uid_value = int(token_uid)
    except ValueError:
        return False

    if token_uid_value != uid or expires_at < int(time.time()):
        return False

    return hmac.compare_digest(signature, _signature(uid, expires_at))


def is_dev_unlocked(request: Request, uid: int) -> bool:
    """Indica se a sessão possui um desbloqueio administrativo válido."""
    return _is_valid_unlock_token(request.cookies.get(DEV_UNLOCK_COOKIE), uid)


def authenticate_dev_admin(
    credentials: OdooCredentials,
    password: str,
) -> OdooClient:
    """Reautentica o usuário e confirma o grupo administrativo do Odoo."""
    client = OdooClient(settings.ODOO_URL)

    try:
        uid = client.authenticate(
            db=credentials.db,
            username=credentials.username,
            password=password,
        )
    except AuthenticationError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha inválida.",
        ) from error

    if uid != credentials.uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A sessão do usuário mudou.",
        )

    client.set_authenticated_session(
        db=credentials.db,
        uid=uid,
        password=password,
    )

    try:
        is_admin = client.execute(
            "res.users",
            "has_group",
            "base.group_system",
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível verificar o perfil administrativo no Odoo.",
        ) from error

    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores do Odoo.",
        )

    return client


def require_dev_admin(request: Request) -> OdooCredentials:
    """Exige login normal e desbloqueio administrativo temporário."""
    require_development_environment()
    credentials = get_odoo_credentials(request)

    if not _is_valid_unlock_token(
        request.cookies.get(DEV_UNLOCK_COOKIE),
        credentials.uid,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Desbloqueie a caixa de ferramentas com sua senha do Odoo.",
        )

    return credentials
