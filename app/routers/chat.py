"""Router do chat de suporte com a equipe de T.I."""

from typing import Any, Dict

from fastapi import APIRouter, Depends

from app.core.auth import OdooClient
from app.core.security import get_odoo_client
from app.models.schemas import ChatMessageRequest
from app.services.chat_service import ChatService

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/resumo")
async def list_summary(client: OdooClient = Depends(get_odoo_client)) -> Dict[str, Any]:
    """IDs das mensagens recebidas hoje da equipe de T.I. (para o aviso de não lidas)."""
    data = ChatService.list_today_messages(client)
    return {"recebidas": [item["id"] for item in data["mensagens"] if not item["eu"]]}


@router.get("/conversa")
async def list_messages(client: OdooClient = Depends(get_odoo_client)) -> Dict[str, Any]:
    """Mensagens de hoje (00:00 a 23:59) no grupo com a equipe de T.I."""
    return ChatService.list_today_messages(client)


@router.post("/conversa/mensagens")
async def send_message(
    payload: ChatMessageRequest,
    client: OdooClient = Depends(get_odoo_client),
) -> Dict[str, Any]:
    """Envia uma mensagem ao grupo com a equipe de T.I. (cria o grupo na primeira vez)."""
    return ChatService.send_message(client, payload.texto.strip())
