"""Módulo core com utilitários da aplicação."""

from app.core.exceptions import *
from app.core.security import *

__all__ = [
    "AuthenticationError",
    "SessionExpiredError",
    "get_odoo_credentials",
    "get_odoo_client",
]
