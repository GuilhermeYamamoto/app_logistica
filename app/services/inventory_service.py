"""Serviço de inventário."""

from typing import Any, Dict, List

from fastapi import HTTPException, status

from collections import defaultdict
import xmlrpc.client
from app.core.auth import OdooClient

import json
import uuid
import httpx


class InventoryService:
    """Serviço responsável por lógica de inventário."""

    @staticmethod
    def get_inventory_stages() -> List[Dict[str, Any]]:
        """Retorna as etapas de inventário."""
        return [
            {
                "key": "recebimento-fiscal",
                "name": "Recebimento Fiscal",
                "picking_type_id": 93,
                "template": "stock_picking/inventario_etapa.html",
            },
            {
                "key": "recebimento-qualidade",
                "name": "Recebimento Qualidade",
                "picking_type_id": 137,
                "template": "stock_picking/recebimento_qualidade.html",
            },
            {
                "key": "estoque-transitorio",
                "name": "Estoque Transitório",
                "picking_type_id": 138,
                "template": "stock_picking/inventario_etapa.html",
            },
            {
                "key": "pre-separacao",
                "name": "Pré-Separação",
                "picking_type_id": 119,
                "template": "stock_picking/inventario_etapa.html",
            },
            {
                "key": "separacao",
                "name": "Separação",
                "picking_type_id": 120,
                "template": "stock_picking/inventario_etapa.html",
            },
            {
                "key": "empacotamento",
                "name": "Empacotamento",
                "picking_type_id": 148,
                "template": "stock_picking/inventario_etapa.html",
            },
            {
                "key": "conferencia-expedicao",
                "name": "Conferencia Expedicao",
                "picking_type_id": 139,
                "template": "stock_picking/inventario_etapa.html",
            },
        ]


    # ========================================================
    # LISTAR OS PICKINGS DE CADA ETAPA DO INVENTARIO
    # ========================================================

    @staticmethod
    def list_stage_records(client: OdooClient, picking_type_id: int) -> Dict[str, Any]:

        try:

            pickings = client.execute("stock.picking", "search_read", [("picking_type_id", "=", picking_type_id), ("state", "!=", "cancel",)], fields=["name", "origin", "partner_id", "state", "scheduled_date", "move_ids_without_package"], order="scheduled_date asc, id asc")
            
            move_ids = [move_id for picking in pickings for move_id in picking["move_ids_without_package"]]

            moves_by_picking: Dict[int, List[Dict[str, Any]]] = defaultdict(list)

            received_quantity_field = None

            if move_ids:
                move_fields = client.execute("stock.move", "fields_get")

                received_quantity_field = next((field for field in ("quantity", "quantity_done") if field in move_fields), None)

                fields = ["picking_id", "product_id", "product_uom_qty"]

                if received_quantity_field is not None:
                    fields.append(received_quantity_field)

                moves = client.execute("stock.move", "search_read", [("id", "in", move_ids)], fields=fields)

                for move in moves:
                    moves_by_picking[move["picking_id"][0]].append(move)

        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível consultar os pickings da etapa solicitada")) from error

        records = []

        for picking in pickings:
            moves = moves_by_picking[picking["id"]]
            product_names = [move["product_id"][1] for move in moves if move["product_id"]]
            expected_quantity = sum(move["product_uom_qty"] for move in moves)
            received_quantity = sum(move.get(received_quantity_field, 0) for move in moves)
            partner = picking["partner_id"]

            records.append({
                            "id": picking["id"],
                            "pv": picking["name"],
                            "reference": picking["name"],
                            "client": (partner[1] if partner else "Sem fornecedor"),
                            "product": (", ".join(product_names) or "Sem produtos"),
                            "expectedQuantity": expected_quantity,
                            "receivedQuantity": received_quantity,
                            "validated": (picking["state"] == "done"),
                            "state": picking["state"],
                            "scheduledDate": picking["scheduled_date"],
                        })

        return {"picking_type_id": picking_type_id, "records": records}

      

    # ========================================================
    # IMPRESSÃO DA ETIQUETA DE QUALIDADE
    # ========================================================

    async def print_report_qualidade(client, picking_id):
        try:
            print("==========================================")
            print("INÍCIO DA IMPRESSÃO")
            print("Picking ID:", picking_id)
            print("Client:", type(client))

            # ========================================================
            # CHAMA O IOT_RENDER DO ODOO
            # ========================================================

            print("Chamando ir.actions.report.iot_render...")

            resultado = client.execute(
                "ir.actions.report",
                "iot_render",
                1202,
                [picking_id],
                {
                    "device_id": "Qualidade - Argox OS-214EX PPLA"
                },
            )

            print("Resultado recebido do Odoo:")
            print(resultado)

            # ========================================================
            # VALIDA RETORNO DO ODOO
            # ========================================================

            if not resultado:
                raise HTTPException(
                    status_code=500,
                    detail="O Odoo não retornou dados para impressão."
                )

            if not isinstance(resultado, (list, tuple)):
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Resposta inesperada do Odoo: "
                        f"{type(resultado).__name__}"
                    )
                )

            if len(resultado) < 3:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Resposta inválida do Odoo. "
                        f"Esperado pelo menos 3 valores, "
                        f"recebido: {len(resultado)}"
                    )
                )

            # ========================================================
            # SEPARA RETORNO DO IOT_RENDER
            # ========================================================

            iot_host = resultado[0]
            device_identifier = resultado[1]
            pdf_base64 = resultado[2]

            print("IoT Host:", iot_host)
            print("Device:", device_identifier)
            print("Documento recebido:", bool(pdf_base64))

            if not iot_host:
                raise HTTPException(
                    status_code=500,
                    detail="O Odoo não retornou o endereço do IoT."
                )

            if not device_identifier:
                raise HTTPException(
                    status_code=500,
                    detail="O Odoo não retornou o identificador da impressora."
                )

            if not pdf_base64:
                raise HTTPException(
                    status_code=500,
                    detail="O Odoo não retornou o documento para impressão."
                )

            # ========================================================
            # MONTA REQUISIÇÃO PARA O IOT
            # ========================================================

            session_id = str(uuid.uuid4())

            payload = {
                "params": {
                    "data": json.dumps({
                        "document": pdf_base64,
                    }),
                    "device_identifier": device_identifier,
                    "session_id": session_id,
                }
            }

            iot_url = f"https://{iot_host}/hw_drivers/action"

            print("URL do IoT:", iot_url)
            print("Device:", device_identifier)
            print("Session ID:", session_id)

            # ========================================================
            # ENVIA PARA O IOT
            # ========================================================

            async with httpx.AsyncClient(timeout=30) as http:
                response = await http.post(
                    iot_url,
                    json=payload,
                )

            print("Status IoT:", response.status_code)
            print("Resposta IoT:", response.text)

            response.raise_for_status()

            # ========================================================
            # RESPOSTA FINAL
            # ========================================================

            try:
                iot_response = response.json()
            except Exception:
                iot_response = {
                    "raw_response": response.text
                }

            print("==========================================")
            print("IMPRESSÃO ENVIADA COM SUCESSO")
            print("==========================================")

            return {
                "success": True,
                "message": "Etiqueta enviada para impressão.",
                "picking_id": picking_id,
                "session_id": session_id,
                "iot_response": iot_response,
            }

        # ============================================================
        # ERRO DO ODOO
        # ============================================================

        except xmlrpc.client.Fault as e:
            print("==========================================")
            print("ERRO XML-RPC DO ODOO")
            print(e)
            print("==========================================")

            raise HTTPException(
                status_code=502,
                detail=f"Erro ao executar impressão no Odoo: {str(e)}",
            )

        # ============================================================
        # ERRO DE COMUNICAÇÃO COM IOT
        # ============================================================

        except httpx.HTTPError as e:
            print("==========================================")
            print("ERRO DE COMUNICAÇÃO COM IOT")
            print(e)
            print("==========================================")

            raise HTTPException(
                status_code=502,
                detail=f"Erro de comunicação com o IoT: {str(e)}",
            )

        # ============================================================
        # HTTP EXCEPTION
        # ============================================================

        except HTTPException:
            raise

        # ============================================================
        # ERRO GERAL
        # ============================================================

        except Exception as e:
            print("==========================================")
            print("ERRO GERAL AO IMPRIMIR")
            print(repr(e))
            print("==========================================")

            raise HTTPException(
                status_code=500,
                detail=f"Erro ao imprimir etiqueta: {str(e)}",
            )

    def button_validate(client, picking_id):
        result = None

        try:
            result = client.execute("stock.picking", "button_validate", [picking_id])

        except xmlrpc.client.Fault as e:
            error_message = str(e)

            if "cannot marshal" in error_message:
                print("AVISO: O picking foi validado, mas não conseguiu serializar o retorno.")

                result = None

            else:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível validar o recebimento no Odoo"))

        return {"success": True, "picking_id": picking_id, "result": result}
