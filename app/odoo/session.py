from dataclasses import dataclass
from secrets import token_urlsafe
from threading import Lock
from typing import Dict, Optional

from app.config import settings
from app.odoo.rpc import OdooRPC


@dataclass(frozen=True)
class OdooCredentials:
    db: str
    username: str
    password: str
    uid: int


class OdooSessionStore:
    """Mantém credenciais no servidor; o navegador recebe somente o token da sessão."""

    def __init__(self) -> None:
        self._sessions: Dict[str, OdooCredentials] = {}
        self._lock = Lock()

    def create(self, credentials: OdooCredentials) -> str:
        token = token_urlsafe(32)
        with self._lock:
            self._sessions[token] = credentials
        return token

    def get(self, token: Optional[str]) -> Optional[OdooCredentials]:
        if token is None:
            return None

        with self._lock:
            return self._sessions.get(token)

    def delete(self, token: Optional[str]) -> None:
        if token is None:
            return

        with self._lock:
            self._sessions.pop(token, None)


odoo_sessions = OdooSessionStore()
