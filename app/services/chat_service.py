"""Chat do suporte de T.I., usando as conversas do Odoo.

Quando o usuário envia a primeira mensagem para o T.I., é criado no Odoo um
grupo (``mail.channel`` privado) com o usuário e todas as pessoas do
departamento de T.I. (``hr.employee.department_id``). O grupo não é apagado:
as próximas mensagens do mesmo usuário vão para ele.

O histórico mostrado no widget reinicia todo dia às 00:00 (horário de
Brasília): só aparecem as mensagens do dia. As mensagens antigas continuam no
Odoo, visíveis para a equipe de T.I. no Discuss.

As chamadas são feitas via XML-RPC com as credenciais da sessão do usuário.
"""

import html
import re
import xmlrpc.client
from datetime import datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from app.config import settings
from app.core.auth import OdooClient


# Fuso de Brasília (UTC-3, sem horário de verão desde 2019).
BRAZIL_TZ = timezone(timedelta(hours=-3))

# Prefixo do nome do grupo no Odoo (ex.: "Suporte T.I. - João Silva").
GROUP_NAME_PREFIX = "Suporte T.I."


class ChatService:
    """Operações do chat de suporte de T.I. no Odoo."""

    CHANNEL_MODEL = "mail.channel"
    MESSAGE_MODEL = "mail.message"
    USER_MODEL = "res.users"
    EMPLOYEE_MODEL = "hr.employee"

    @staticmethod
    def _odoo_error(error: xmlrpc.client.Fault) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível comunicar com o chat do Odoo.",
        )

    @staticmethod
    def _execute(client: OdooClient, model: str, method: str, *args, **kwargs) -> Any:
        try:
            return client.execute(model, method, *args, **kwargs)
        except xmlrpc.client.Fault as error:
            raise ChatService._odoo_error(error)

    @staticmethod
    def _group_marker(uid: int) -> str:
        """Texto gravado na descrição do grupo, usado para reencontrá-lo depois."""
        return f"Atendimento de T.I. aberto pelo app de logística (usuário {uid})."

    # ---------- Pessoas ----------

    @staticmethod
    def get_me(client: OdooClient) -> Dict[str, Any]:
        """Partner e nome do usuário logado."""
        users = ChatService._execute(
            client,
            ChatService.USER_MODEL,
            "read",
            [client.uid],
            fields=["name", "partner_id"],
        )
        return {
            "name": users[0].get("name") or "",
            "partner_id": int(users[0]["partner_id"][0]),
        }

    @staticmethod
    def get_ti_partner_ids(client: OdooClient) -> List[int]:
        """Partners de todos os usuários cujo funcionário está no departamento de T.I."""
        employees = ChatService._execute(
            client,
            ChatService.EMPLOYEE_MODEL,
            "search_read",
            [
                ("department_id", "=", settings.TI_DEPARTMENT_ID),
                ("user_id", "!=", False),
            ],
            fields=["user_id"],
        )
        user_ids = sorted({int(item["user_id"][0]) for item in employees if item.get("user_id")})

        if not user_ids:
            return []

        users = ChatService._execute(
            client,
            ChatService.USER_MODEL,
            "search_read",
            [("id", "in", user_ids)],
            fields=["partner_id"],
        )
        return sorted({int(user["partner_id"][0]) for user in users if user.get("partner_id")})

    # ---------- Grupo ----------

    @staticmethod
    def find_group(client: OdooClient) -> Optional[Dict[str, Any]]:
        """Grupo de suporte já existente do usuário logado (ou None)."""
        groups = ChatService._execute(
            client,
            ChatService.CHANNEL_MODEL,
            "search_read",
            [
                ("create_uid", "=", client.uid),
                ("description", "=", ChatService._group_marker(client.uid)),
            ],
            fields=["id", "channel_partner_ids"],
            order="id asc",
            limit=1,
        )
        return groups[0] if groups else None

    @staticmethod
    def get_or_create_group(client: OdooClient) -> int:
        """Retorna o grupo do usuário com a equipe de T.I., criando-o se não existir.

        Se alguém entrou no departamento de T.I. depois que o grupo foi criado,
        a pessoa é adicionada ao grupo.
        """
        me = ChatService.get_me(client)
        ti_partner_ids = ChatService.get_ti_partner_ids(client)

        if not ti_partner_ids:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Nenhuma pessoa da equipe de T.I. foi encontrada no Odoo.",
            )

        members = sorted(set(ti_partner_ids) | {me["partner_id"]})
        group = ChatService.find_group(client)

        if group is None:
            return int(ChatService._execute(
                client,
                ChatService.CHANNEL_MODEL,
                "create",
                {
                    "name": f"{GROUP_NAME_PREFIX} - {me['name']}".strip(" -"),
                    "description": ChatService._group_marker(client.uid),
                    "channel_type": "channel",
                    "public": "private",
                    "channel_partner_ids": [(4, partner_id) for partner_id in members],
                },
            ))

        missing = set(members) - set(group.get("channel_partner_ids") or [])

        if missing:
            ChatService._execute(
                client,
                ChatService.CHANNEL_MODEL,
                "write",
                [group["id"]],
                {"channel_partner_ids": [(4, partner_id) for partner_id in sorted(missing)]},
            )

        return int(group["id"])

    # ---------- Mensagens ----------

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
    def list_today_messages(client: OdooClient) -> Dict[str, Any]:
        """Mensagens de hoje no grupo de suporte. Não cria o grupo se ele não existir."""
        group = ChatService.find_group(client)

        if group is None:
            return {"mensagens": []}

        my_partner_id = ChatService.get_me(client)["partner_id"]
        start, end = ChatService._today_range_utc()

        records = ChatService._execute(
            client,
            ChatService.MESSAGE_MODEL,
            "search_read",
            [
                ("model", "=", ChatService.CHANNEL_MODEL),
                ("res_id", "=", group["id"]),
                ("message_type", "=", "comment"),
                ("date", ">=", start),
                ("date", "<=", end),
            ],
            fields=["id", "body", "author_id", "date"],
            order="date asc, id asc",
        )

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
    def send_message(client: OdooClient, texto: str) -> Dict[str, Any]:
        """Envia a mensagem para o grupo de suporte (criando o grupo na primeira vez)."""
        channel_id = ChatService.get_or_create_group(client)

        # O texto é escapado: o Odoo guarda o corpo como HTML.
        body = f"<p>{html.escape(texto)}</p>"

        message_id = ChatService._execute(
            client,
            ChatService.CHANNEL_MODEL,
            "message_post",
            [channel_id],
            body=body,
            message_type="comment",
            subtype_xmlid="mail.mt_comment",
        )

        return {"id": message_id, "texto": texto, "eu": True}
