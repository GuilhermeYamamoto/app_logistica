"""Router do chat privado com a equipe de T.I."""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends

from app.core.auth import OdooClient
from app.core.security import get_odoo_client
from app.models.schemas import ChatMessageRequest
from app.services.chat_service import ChatService

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/equipe")
async def list_team(client: OdooClient = Depends(get_odoo_client)) -> List[Dict[str, str]]:
    """Pessoas com quem o usuário pode conversar."""
    return ChatService.get_team()


@router.get("/resumo")
async def list_summary(client: OdooClient = Depends(get_odoo_client)) -> Dict[str, Any]:
    """IDs das mensagens recebidas hoje de cada pessoa da equipe (para o aviso de não lidas)."""
    pessoas: Dict[str, Dict[str, List[int]]] = {}
    for member in ChatService.get_team():
        data = ChatService.list_today_messages(client, member["key"])
        pessoas[member["key"]] = {
            "recebidas": [item["id"] for item in data["mensagens"] if not item["eu"]],
        }
    return {"pessoas": pessoas}


@router.get("/conversas/{pessoa}")
async def list_messages(
    pessoa: str,
    client: OdooClient = Depends(get_odoo_client),
) -> Dict[str, Any]:
    """Mensagens trocadas hoje (00:00 a 23:59) com a pessoa escolhida."""
    return ChatService.list_today_messages(client, pessoa)


@router.post("/conversas/{pessoa}/mensagens")
async def send_message(
    pessoa: str,
    payload: ChatMessageRequest,
    client: OdooClient = Depends(get_odoo_client),
) -> Dict[str, Any]:
    """Envia uma mensagem privada para a pessoa escolhida."""
    return ChatService.send_message(client, pessoa, payload.texto.strip())
