"""Follow-up do pedido de venda.

A regra de negócio fica no Odoo (wizard ``sale.followup.wizard`` do módulo
``indufix_custom``). Este serviço apenas aciona o wizard pelo XML-RPC:

1. ``stock.picking.action_open_followup_wizard`` cria o wizard já ligado ao
   pedido de venda do picking e devolve a ação com ``res_id``.
2. ``historico_html`` é lido do wizard para exibir o histórico.
3. ``mensagem`` é gravado no wizard e ``action_send`` registra o follow-up
   no pedido de venda (com ``subtype`` ``indufix_custom.mt_sale_followup``).
"""

import re
import xmlrpc.client
from typing import Any, Dict

from fastapi import HTTPException, status

from app.core.auth import OdooClient


class FollowupService:
    """Acesso ao follow-up do pedido de venda a partir de um picking."""

    WIZARD_MODEL = "sale.followup.wizard"
    PICKING_MODEL = "stock.picking"
    WIZARD_READ_FIELDS = ["historico_html", "source_name", "allowed_order_names", "partner_name"]

    @staticmethod
    def _odoo_error(error: xmlrpc.client.Fault) -> HTTPException:
        """
        Converte um UserError do Odoo em erro 400 com a mensagem original.
        Qualquer outra falha vira 502.
        """
        text = str(error.faultString or "")
        match = re.search(r"(?:UserError|ValidationError): (.+)", text)
        if match:
            return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=match.group(1).strip())
        return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível processar o follow-up no Odoo.")

    @staticmethod
    def _open_wizard(client: OdooClient, picking_id: int) -> int:
        """Abre o wizard a partir do picking e devolve o id do wizard criado."""
        try:
            action = client.execute(FollowupService.PICKING_MODEL, "action_open_followup_wizard", [picking_id])
        except xmlrpc.client.Fault as error:
            raise FollowupService._odoo_error(error) from error
        except (OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível abrir o follow-up do pedido.") from error

        wizard_id = action.get("res_id") if isinstance(action, dict) else None
        if not wizard_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este picking não possui pedido de venda vinculado.")
        return int(wizard_id)

    @staticmethod
    def _read_wizard(client: OdooClient, wizard_id: int) -> Dict[str, Any]:
        """
        Lê os campos de exibição do wizard. Os campos escolhidos são calculados
        com sudo no Odoo, então o usuário não precisa de acesso a vendas para vê-los.
        """
        rows = client.execute(
            FollowupService.WIZARD_MODEL,
            "read",
            [wizard_id],
            fields=FollowupService.WIZARD_READ_FIELDS,
        )
        if not rows:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível ler o histórico do follow-up.")
        return rows[0]

    @staticmethod
    def _build_payload(picking_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "success": True,
            "picking_id": picking_id,
            "order_name": data.get("allowed_order_names") or None,
            "partner_name": data.get("partner_name") or None,
            "source_name": data.get("source_name") or None,
            "historico_html": data.get("historico_html") or "",
        }

    @staticmethod
    def get_history(client: OdooClient, picking_id: int) -> Dict[str, Any]:
        """Retorna o histórico de follow-ups do pedido de venda ligado ao picking."""
        try:
            wizard_id = FollowupService._open_wizard(client, picking_id)
            data = FollowupService._read_wizard(client, wizard_id)
        except HTTPException:
            raise
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível consultar o histórico do follow-up.") from error
        return FollowupService._build_payload(picking_id, data)

    @staticmethod
    def post_message(client: OdooClient, picking_id: int, message: str) -> Dict[str, Any]:
        """Registra uma mensagem de follow-up no pedido de venda ligado ao picking."""
        message = (message or "").strip()
        if not message:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A mensagem não pode estar vazia.")

        try:
            wizard_id = FollowupService._open_wizard(client, picking_id)
            client.execute(FollowupService.WIZARD_MODEL, "write", [wizard_id], {"mensagem": message})
            client.execute(FollowupService.WIZARD_MODEL, "action_send", [wizard_id])
            data = FollowupService._read_wizard(client, wizard_id)
        except HTTPException:
            raise
        except xmlrpc.client.Fault as error:
            raise FollowupService._odoo_error(error) from error
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível registrar o follow-up no pedido de venda.") from error
        return FollowupService._build_payload(picking_id, data)
