"""Chat privado com a equipe de T.I., usando as conversas do Odoo.

Cada pessoa da equipe tem uma conversa privada (``mail.channel`` do tipo
``chat``) com o usuário logado. Os métodos usados são os mesmos que o
frontend do Odoo 15 chama (``channel_get``, ``message_post``), executados
no servidor via XML-RPC com as credenciais da sessão.
"""

import html
import re
import xmlrpc.client
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from app.core.auth import OdooClient


# Fuso de Brasília (UTC-3, sem horário de verão desde 2019).
BRAZIL_TZ = timezone(timedelta(hours=-3))

# Pessoas disponíveis no chat de T.I.: chave usada pelo frontend -> dados no Odoo.
TI_TEAM: Dict[str, Dict[str, str]] = {
    "guilherme": {"name": "Guilherme", "login": "guilherme.yamamoto@indufix.com.br"},
    "gabriel": {"name": "Gabriel", "login": "gabriel.rodrigues@indufix.com.br"},
    "fernando": {"name": "Fernando", "login": "fernando.ribeiro@indufix.com.br"},
}


class ChatService:
    """Operações de chat privado no Odoo."""

    CHANNEL_MODEL = "mail.channel"
    MESSAGE_MODEL = "mail.message"
    USER_MODEL = "res.users"

    @staticmethod
    def _odoo_error(error: xmlrpc.client.Fault) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível comunicar com o chat do Odoo.",
        )

    @staticmethod
    def get_team() -> List[Dict[str, str]]:
        """Lista as pessoas disponíveis para conversa."""
        return [{"key": key, "name": data["name"]} for key, data in TI_TEAM.items()]

    @staticmethod
    def get_team_member(key: str) -> Dict[str, str]:
        member = TI_TEAM.get(key)
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pessoa não encontrada na equipe de T.I.",
            )
        return member

    @staticmethod
    def get_partner_id(client: OdooClient, login: str) -> int:
        """Retorna o partner do usuário Odoo com o login informado."""
        try:
            users = client.execute(
                ChatService.USER_MODEL,
                "search_read",
                [("login", "=", login)],
                fields=["partner_id"],
                limit=1,
                context={"active_test": False},
            )
        except xmlrpc.client.Fault as error:
            raise ChatService._odoo_error(error)

        if not users or not users[0].get("partner_id"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado no Odoo.",
            )
        return int(users[0]["partner_id"][0])

    @staticmethod
    def get_my_partner_id(client: OdooClient) -> int:
        try:
            users = client.execute(
                ChatService.USER_MODEL,
                "read",
                [client.uid],
                fields=["partner_id"],
            )
        except xmlrpc.client.Fault as error:
            raise ChatService._odoo_error(error)

        return int(users[0]["partner_id"][0])

    @staticmethod
    def get_channel_id(client: OdooClient, partner_id: int) -> int:
        """Retorna (ou cria) a conversa privada entre o usuário logado e o partner."""
        try:
            channel = client.execute(ChatService.CHANNEL_MODEL, "channel_get", [partner_id])
        except xmlrpc.client.Fault as error:
            raise ChatService._odoo_error(error)

        return int(channel["id"])

    @staticmethod
    def _today_range_utc() -> tuple[str, str]:
        """Intervalo de hoje (00:00 a 23:59:59, horário de Brasília) em UTC, no formato do Odoo."""
        now = datetime.now(BRAZIL_TZ)
        start = datetime.combine(now.date(), time.min, tzinfo=BRAZIL_TZ)
        end = datetime.combine(now.date(), time.max, tzinfo=BRAZIL_TZ)
        fmt = "%Y-%m-%d %H:%M:%S"
        return (
            start.astimezone(timezone.utc).strftime(fmt),
            end.astimezone(timezone.utc).strftime(fmt),
        )

    @staticmethod
    def _plain_text(body: str) -> str:
        text = re.sub(r"<br\s*/?>", "\n", body or "", flags=re.IGNORECASE)
        text = re.sub(r"</p>\s*", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", "", text)
        return html.unescape(text).strip()

    @staticmethod
    def list_today_messages(client: OdooClient, key: str) -> Dict[str, Any]:
        """Mensagens trocadas hoje com a pessoa escolhida."""
        member = ChatService.get_team_member(key)
        partner_id = ChatService.get_partner_id(client, member["login"])
        my_partner_id = ChatService.get_my_partner_id(client)
        channel_id = ChatService.get_channel_id(client, partner_id)

        start, end = ChatService._today_range_utc()
        domain = [
            ("model", "=", ChatService.CHANNEL_MODEL),
            ("res_id", "=", channel_id),
            ("message_type", "=", "comment"),
            ("date", ">=", start),
            ("date", "<=", end),
        ]

        try:
            records = client.execute(
                ChatService.MESSAGE_MODEL,
                "search_read",
                domain,
                fields=["id", "body", "author_id", "date"],
                order="date asc, id asc",
            )
        except xmlrpc.client.Fault as error:
            raise ChatService._odoo_error(error)

        messages = []
        for record in records:
            author = record.get("author_id") or [None, ""]
            messages.append({
                "id": record["id"],
                "texto": ChatService._plain_text(record.get("body", "")),
                "autor": author[1] or "",
                "eu": bool(author[0] == my_partner_id),
                "data": record.get("date", ""),
            })

        return {"mensagens": messages}

    @staticmethod
    def send_message(client: OdooClient, key: str, texto: str) -> Dict[str, Any]:
        """Envia uma mensagem privada para a pessoa escolhida."""
        member = ChatService.get_team_member(key)
        partner_id = ChatService.get_partner_id(client, member["login"])
        channel_id = ChatService.get_channel_id(client, partner_id)

        # O texto é escapado: o Odoo guarda o corpo como HTML.
        body = f"<p>{html.escape(texto)}</p>"

        try:
            message_id = client.execute(
                ChatService.CHANNEL_MODEL,
                "message_post",
                [channel_id],
                body=body,
                message_type="comment",
                subtype_xmlid="mail.mt_comment",
            )
        except xmlrpc.client.Fault as error:
            raise ChatService._odoo_error(error)

        return {"id": message_id, "texto": texto, "eu": True}
