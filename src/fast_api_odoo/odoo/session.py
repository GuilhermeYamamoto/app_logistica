from dataclasses import dataclass
from secrets import token_urlsafe
from threading import Lock

from fastapi import HTTPException, Request, status

from fast_api_odoo.odoo.rpc import OdooRPC

SESSION_COOKIE_NAME = "odoo_session"
ODOO_URL = "https://trn-serp.indufix.com.br"
ODOO_DB = "odoo-trn"


@dataclass(frozen=True)
class OdooCredentials:
    db: str
    username: str
    password: str
    uid: int


class OdooSessionStore:
    """Mantém credenciais no servidor; o navegador recebe somente o token da sessão."""

    def __init__(self) -> None:
        self._sessions: dict[str, OdooCredentials] = {}
        self._lock = Lock()

    def create(self, credentials: OdooCredentials) -> str:
        token = token_urlsafe(32)
        with self._lock:
            self._sessions[token] = credentials
        return token

    def get(self, token: str | None) -> OdooCredentials | None:
        if token is None:
            return None

        with self._lock:
            return self._sessions.get(token)

    def delete(self, token: str | None) -> None:
        if token is None:
            return

        with self._lock:
            self._sessions.pop(token, None)


odoo_sessions = OdooSessionStore()


def get_odoo_credentials(request: Request) -> OdooCredentials:
    credentials = odoo_sessions.get(request.cookies.get(SESSION_COOKIE_NAME))
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )
    return credentials


def get_odoo_client(request: Request) -> OdooRPC:
    credentials = get_odoo_credentials(request)
    client = OdooRPC(ODOO_URL)
    client.set_authenticated_session(
        db=credentials.db,
        uid=credentials.uid,
        password=credentials.password,
    )
    return client
