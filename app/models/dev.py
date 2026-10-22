"""Schemas das ferramentas de desenvolvimento."""

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class DevUnlockRequest(BaseModel):
    """Senha usada para desbloquear temporariamente as ferramentas."""

    password: str = Field(min_length=1)


class DevSearchReadRequest(BaseModel):
    """Consulta controlada de registros via search_read."""

    model: str = Field(pattern=r"^[a-zA-Z0-9_.]+$")
    domain: List[Any] = Field(default_factory=list)
    fields: List[str] = Field(default_factory=list)
    limit: int = Field(default=30, ge=1, le=100)


class DevWriteRequest(BaseModel):
    """Alteração controlada de registros via write."""

    model: str = Field(pattern=r"^[a-zA-Z0-9_.]+$")
    ids: List[int] = Field(min_length=1, max_length=100)
    values: Dict[str, Any] = Field(min_length=1)
    dry_run: bool = True


class SaleOrderToolRequest(BaseModel):
    """Parâmetros da ferramenta CRM Lead para Sale Order."""

    lead_id: int = Field(gt=0)
    execute: bool = False
