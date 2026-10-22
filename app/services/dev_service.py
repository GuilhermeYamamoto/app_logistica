"""Serviços RPC das ferramentas de desenvolvimento."""

import random
import xmlrpc.client
from typing import Any, Callable, Dict, List, Optional

from app.core.auth import OdooClient


Log = Callable[[str], None]

class DevService:
    """Serviço responsável pelas ferramentas isoladas de desenvolvimento."""

    @staticmethod
    def get_dev_options() -> List[Dict[str, Any]]:
        """Retorna as opções de ferramentas de desenvolvimento."""
        return [
            {
                "key": "sale-order",
                "name": "Sale Order (Vendas)",
                "description": "Cria uma cotação a partir de um CRM Lead.",
                "template": "dev/sale-order.html",
                "route": "/dev/tools/sale-order",
            },
            {
                "key": "purchase-order",
                "name": "Purchase Order(Compras)",
                "description": "Ferramentas para pedidos de compra.",
                "template": "dev/purchase-order.html",
                "route": "/dev/tools/purchase-order",
            },
            {
                "key": "stock-picking",
                "name": "Stock Picking(Inventário)",
                "description": "Ferramentas para transferências e inventário.",
                "template": "dev/stock-picking.html",
                "route": "/dev/tools/stock-picking",
            },
        ]

    @staticmethod
    def get_toolbox_tools(toolbox_key: str) -> List[Dict[str, str]]:
        """Retorna as ferramentas disponíveis em uma caixa específica."""
        toolboxes = {
            "sale-order": [
                {
                    "key": "create-sale-order",
                    "name": "Criar pedido de venda",
                    "description": "Cria e confirma uma cotação a partir de um CRM Lead.",
                    "route": "/dev/tools/sale-order/create-sale-order",
                },
            ],
            "purchase-order": [],
            "stock-picking": [],
        }
        return toolboxes.get(toolbox_key, [])

    @staticmethod
    def create_sale_order_from_lead(
        client: OdooClient,
        lead_id: int,
        execute: bool = False,
        log: Optional[Log] = None,
    ) -> Dict[str, Any]:
        """Prepara ou executa o fluxo CRM Lead para Sale Order via RPC."""
        write_log = log or (lambda message: None)
        lead = DevService._get_lead(client, lead_id, write_log)
        supplierinfo = DevService._get_valid_supplierinfo(client, write_log)
        product_ids = DevService._get_sellable_products(client, supplierinfo, write_log)
        order_lines = DevService._build_order_lines(product_ids, write_log)
        vals = DevService._build_sale_order_values(client, lead, order_lines, write_log)

        result: Dict[str, Any] = {
            "execute": execute,
            "lead_id": lead_id,
            "lead_name": lead["name"],
            "values": vals,
        }

        if not execute:
            write_log("Simulação concluída. Nenhuma alteração foi enviada ao Odoo.")
            return result

        sale_order_id = DevService._create_sale_order(client, vals, write_log)
        DevService._confirm_sale_order(client, sale_order_id, write_log)
        result["sale_order_id"] = sale_order_id
        write_log(f"Processo concluído. Sale Order ID: {sale_order_id}")
        return result

    @staticmethod
    def _get_lead(client: OdooClient, lead_id: int, log: Log) -> Dict[str, Any]:
        log(f"Buscando CRM Lead {lead_id}...")
        leads = client.execute(
            "crm.lead",
            "search_read",
            [["id", "=", lead_id]],
            fields=["name", "partner_id", "company_id", "team_id", "user_id"],
            limit=1,
        )
        if not leads:
            raise RuntimeError(f"CRM Lead {lead_id} não foi encontrado.")
        lead = leads[0]
        for field in ("partner_id", "company_id", "team_id", "user_id"):
            if not lead.get(field):
                raise RuntimeError(f"O CRM Lead não possui o campo obrigatório {field}.")
        log(f"Lead encontrado: {lead['name']}")
        return lead

    @staticmethod
    def _get_valid_supplierinfo(client: OdooClient, log: Log) -> List[Dict[str, Any]]:
        log("Buscando fornecedores permitidos...")
        suppliers = client.execute(
            "product.supplierinfo",
            "search_read",
            [
                ["name", "not in", [404422, 374768, 376984]],
                ["product_tmpl_id", "!=", False],
                ["price", ">", 0],
            ],
            fields=["product_tmpl_id", "name", "price", "min_qty", "delay"],
            limit=False,
        )
        if not suppliers:
            raise RuntimeError("Nenhum fornecedor permitido foi encontrado.")
        log(f"Fornecedores válidos encontrados: {len(suppliers)}")
        return suppliers

    @staticmethod
    def _get_sellable_products(
        client: OdooClient,
        suppliers: List[Dict[str, Any]],
        log: Log,
    ) -> List[int]:
        template_ids = {
            item["product_tmpl_id"][0]
            for item in suppliers
            if item.get("product_tmpl_id")
        }
        if not template_ids:
            raise RuntimeError("Nenhum produto com fornecedor permitido foi encontrado.")

        product_ids = client.search(
            "product.product",
            [
                ["sale_ok", "=", True],
                ["detailed_type", "=", "product"],
                ["product_tmpl_id", "in", list(template_ids)],
            ],
        )
        if not product_ids:
            raise RuntimeError(
                "Nenhum produto vendável com fornecedor permitido foi encontrado."
            )
        log(f"Produtos vendáveis encontrados: {len(product_ids)}")
        return product_ids

    @staticmethod
    def _build_order_lines(product_ids: List[int], log: Log) -> List[Any]:
        quantity = min(random.randint(1, 5), len(product_ids))
        selected_ids = random.sample(product_ids, quantity)
        lines = [
            [
                0,
                0,
                {
                    "product_id": product_id,
                    "product_uom_qty": random.randint(1, 10),
                    "price_unit": round(random.uniform(1.0, 100.0), 2),
                },
            ]
            for product_id in selected_ids
        ]
        if not lines:
            raise RuntimeError("Nenhuma linha de produto foi gerada; a cotação não será criada.")
        log(f"Linhas de produto geradas: {len(lines)}")
        return lines

    @staticmethod
    def _build_sale_order_values(
        client: OdooClient,
        lead: Dict[str, Any],
        order_lines: List[Any],
        log: Log,
    ) -> Dict[str, Any]:
        payment_term_id = DevService._random_record(client, "account.payment.term", log)
        incoterm_id = DevService._random_record(client, "account.incoterms", log)
        carrier_id = DevService._random_record(client, "delivery.carrier", log)
        company_id = lead["company_id"][0]
        vals = {
            "partner_id": lead["partner_id"][0],
            "opportunity_id": lead["id"],
            "company_id": company_id,
            "payment_term_id": payment_term_id,
            "incoterm": incoterm_id,
            "carrier_id": carrier_id,
            "team_id": lead["team_id"][0],
            "user_id": lead["user_id"][0],
            "id_crm": lead["id"],
            "empresa_faturamento_id": company_id,
            "approver_id": client.uid,
            "order_line": order_lines,
        }
        log("Valores da Sale Order preparados.")
        return vals

    @staticmethod
    def _random_record(client: OdooClient, model: str, log: Log) -> Optional[int]:
        ids = client.search(model)
        if not ids:
            log(f"Aviso: nenhum registro encontrado para {model}.")
            return None
        record_id = random.choice(ids)
        log(f"Registro selecionado em {model}: ID {record_id}")
        return record_id

    @staticmethod
    def _create_sale_order(
        client: OdooClient,
        vals: Dict[str, Any],
        log: Log,
    ) -> int:
        log("Criando cotação no Odoo...")
        sale_order_id = client.create("sale.order", vals)
        if not sale_order_id:
            raise RuntimeError("O Odoo não retornou o ID da cotação criada.")
        log(f"Cotação criada com sucesso. Sale Order ID: {sale_order_id}")
        return sale_order_id

    @staticmethod
    def _confirm_sale_order(client: OdooClient, sale_order_id: int, log: Log) -> None:
        log(f"Executando fluxo de confirmação da Sale Order {sale_order_id}...")
        DevService._execute_allowing_none(
            client,
            "sale.order",
            "get_item_cost",
            [sale_order_id],
        )
        log("Custos atualizados.")
        client.execute(
            "ir.actions.server",
            "read",
            [1817],
            fields=["name", "model_id", "state"],
        )
        validation_result = DevService._execute_allowing_none(
            client,
            "ir.actions.server",
            "run",
            [1817],
            context={
                "active_model": "sale.order",
                "active_id": sale_order_id,
                "active_ids": [sale_order_id],
            },
        )
        log(f"Validação executada: {validation_result!r}")
        errors = client.execute(
            "sale.order.validation",
            "search_read",
            [["sale_id", "=", sale_order_id]],
        )
        if errors:
            log(f"Erros encontrados na validação: {len(errors)}")
            DevService._archive_validation_errors(client, errors, log)
        DevService._execute_allowing_none(
            client,
            "sale.order",
            "action_integra_crm",
            [sale_order_id],
        )
        log("Integração com CRM executada.")
        DevService._execute_allowing_none(
            client,
            "ir.actions.server",
            "run",
            [1817],
            context={
                "active_model": "sale.order",
                "active_id": sale_order_id,
                "active_ids": [sale_order_id],
            },
        )
        DevService._execute_allowing_none(
            client,
            "sale.order",
            "action_confirm",
            [sale_order_id],
        )
        log(f"Sale Order {sale_order_id} aprovada com sucesso.")

    @staticmethod
    def _archive_validation_errors(
        client: OdooClient,
        errors: List[Dict[str, Any]],
        log: Log,
    ) -> None:
        """Arquiva erros apenas quando o modelo oferece o campo active."""
        fields = client.execute(
            "sale.order.validation",
            "fields_get",
            [],
            attributes=["string", "type"],
        )
        if "active" not in fields:
            log(
                "Aviso: sale.order.validation não possui o campo active; "
                "os erros não serão arquivados."
            )
            return

        error_ids = [error["id"] for error in errors if error.get("id")]
        if not error_ids:
            log("Aviso: os erros de validação não possuem IDs para arquivamento.")
            return

        client.write("sale.order.validation", error_ids, {"active": False})
        log("Erros de validação arquivados.")

    @staticmethod
    def _execute_allowing_none(
        client: OdooClient,
        model: str,
        method: str,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """Aceita o Fault conhecido quando o Odoo conclui e retorna None."""
        try:
            return client.execute(model, method, *args, **kwargs)
        except xmlrpc.client.Fault as error:
            if isinstance(error, xmlrpc.client.Fault) and "cannot marshal None" in str(error):
                return None
            raise
