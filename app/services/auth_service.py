"""Serviço de autenticação."""

import xmlrpc.client
from typing import Optional

from app.config import settings
from app.core.exceptions import AuthenticationError, OdooConnectionError
from app.odoo.rpc import OdooRPC
from app.odoo.session import odoo_sessions, OdooCredentials


class AuthService:
    """Serviço responsável por lógica de autenticação."""

    @staticmethod
    def authenticate(username: str, password: str) -> str:
        """
        Autentica o usuário no Odoo e retorna um token de sessão.

        Args:
            username: Nome de usuário
            password: Senha

        Returns:
            Token de sessão

        Raises:
            AuthenticationError: Se falhar na autenticação
            OdooConnectionError: Se não conseguir conectar ao Odoo
        """
        try:
            client = OdooRPC(settings.ODOO_URL)
            uid = client.authenticate(
                db=settings.ODOO_DB,
                username=username,
                password=password,
            )
        except AuthenticationError:
            raise
        except (OSError, xmlrpc.client.Error) as e:
            raise OdooConnectionError(
                "Não foi possível conectar ao Odoo. Tente novamente."
            ) from e

        # Criar sessão
        session_token = odoo_sessions.create(
            OdooCredentials(
                db=settings.ODOO_DB,
                username=username,
                password=password,
                uid=uid,
            )
        )
        return session_token

    @staticmethod
    def logout(token: Optional[str]) -> None:
        """Remove a sessão."""
        if token:
            odoo_sessions.delete(token)
