"""Módulo de autenticação e sessões com Odoo."""

from app.core.auth.odoo_client import OdooClient
from app.core.auth.service import OdooAuthService
from app.core.auth.session import (
    BaseSessionStore,
    MemorySessionStore,
    OdooCredentials,
    RedisSessionStore,
    session_store,
)

__all__ = [
    "OdooClient",
    "OdooAuthService",
    "OdooCredentials",
    "BaseSessionStore",
    "MemorySessionStore",
    "RedisSessionStore",
    "session_store",
]
