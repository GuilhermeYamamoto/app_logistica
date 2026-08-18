"""Exceções customizadas da aplicação."""


class AuthenticationError(Exception):
    """Erro ao autenticar no Odoo."""

    pass


class SessionExpiredError(Exception):
    """Sessão expirada."""

    pass


class OdooConnectionError(Exception):
    """Erro ao conectar ao Odoo."""

    pass
