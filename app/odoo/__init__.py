"""Módulo de integração com Odoo."""

from app.odoo.rpc import OdooRPC
from app.odoo.session import OdooSessionStore, OdooCredentials, odoo_sessions

__all__ = ["OdooRPC", "OdooSessionStore", "OdooCredentials", "odoo_sessions"]
