"""Schemas Pydantic para validação de dados."""

from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Dados de login."""

    username: str
    password: str


class ModuleInfo(BaseModel):
    """Informações de um módulo Odoo."""

    name: str
    model: str
    description: str
    route: Optional[str] = None


class ApiResponse(BaseModel):
    """Resposta padrão da API."""

    success: bool
    message: str
    data: Optional[dict] = None
