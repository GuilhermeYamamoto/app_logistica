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

class QualityAlert(BaseModel):
    """Modelo de Alerta de Qualidade."""

    picking_id: int
    reprovacao: str
    quantidade_nao_conforme: int
    descricao_geral: str
    especificado_quality: str
    encontrado_quality: str

class ReceivedQuantity(BaseModel):
    """Modelo para atualizar a quantidade recebida."""

    picking_id: int
    received_quantity: float

