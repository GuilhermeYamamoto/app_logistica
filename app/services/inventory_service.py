"""Serviço de inventário."""

from typing import Any, Dict, List
from fastapi import HTTPException, status
from collections import defaultdict
import xmlrpc.client
from app.core.auth import OdooClient
import json
import uuid
import re
from html import unescape


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
                "template": "stock_picking/recebimento_fiscal.html",
            },
            {
                "key": "recebimento-qualidade",
                "name": "Recebimento Qualidade",
                "picking_type_id": 137,
                "template": "stock_picking/recebimento_qualidade.html",
            },
            {
                "key": "pre-separacao",
                "name": "Pré-Separação",
                "picking_type_id": 119,
                "template": "stock_picking/pre_separacao.html",
            },
            {
                "key": "separacao",
                "name": "Separação",
                "picking_type_id": 120,
                "template": "stock_picking/separacao.html",
            },
            {
                "key": "conferencia-separacao",
                "name": "Conferencia Separacao",
                "picking_type_id": 1200, #Esse picking_type_id nao existe no Odoo, mas é usado no FastAPI para diferenciar a etapa de conferencia de separacao e separacao, que no Odoo são realizadas no mesmo picking_type_id (120)
                "template": "stock_picking/conferencia_separacao.html",
            },
            {
                "key": "empacotamento",
                "name": "Empacotamento",
                "picking_type_id": 148,
                "template": "stock_picking/empacotamento.html",
            },
            {
                "key": "armazenamento-expedicao",
                "name": "Armazenamento Expedicao",
                "picking_type_id": 1390, # Esse picking_type_id nao existe no Odoo, mas é usado no FastAPI para diferenciar a etapa de armazenamento e conferencia da expedicao, que no Odoo são realizadas no mesmo picking_type_id (139)
                "template": "stock_picking/armazenamento_expedicao.html",
            },
            {
                "key": "conferencia-expedicao",
                "name": "Conferencia Expedicao",
                "picking_type_id": 139,
                "template": "stock_picking/conferencia_expedicao.html"
            },
            {
                "key": "faturamento",
                "name": "Faturamento",
                "picking_type_id": 134,
                "template": "stock_picking/faturamento.html"
            }
        ]

    ####################################
    #  LISTAR OS PICKINGS DE CADA ETAPA
    ####################################
    #
    #  Consulta os pickings do Odoo pertencentes ao tipo de operação
    #  informado. Também consulta os movimentos relacionados a cada
    #  picking para obter os produtos e as quantidades esperadas e
    #  recebidas.
    #
    #  Ao final, organiza os dados em um formato simplificado para
    #  utilização pelo frontend.
    #
    ####################################
    @staticmethod
    def list_stage_records(client: OdooClient, picking_type_id: int) -> Dict[str, Any]:
        try:
            pickings = None
            if picking_type_id not in [120, 1200, 139, 1390]: # As etapas listadas tem particularidades (são divididas em duas etapas no FastAPI, mas no Odoo são realizadas no mesmo picking_type_id)
                pickings = client.execute("stock.picking", "search_read", [("picking_type_id", "=", picking_type_id), ("state", "=", "assigned")], fields=["name", "origin", "partner_id", "state", "scheduled_date", "move_ids_without_package", "move_line_ids_without_package", "fotos_count", "pedido_compra_id", "pedido_venda_id", "parent_dfe_nfe_infnfe_ide_nnf", "user_id", "x_studio_local_do_material"], order="scheduled_date asc, id asc")
            else:
                if picking_type_id == 120: # Separação
                    pickings = client.execute("stock.picking", "search_read", [("picking_type_id", "=", picking_type_id), ("state", "in", ["assigned"]), ("tag_ids", "not ilike", [32])], fields=["name", "origin", "partner_id", "state", "scheduled_date", "move_ids_without_package", "move_line_ids_without_package", "fotos_count", "pedido_compra_id", "pedido_venda_id", "parent_dfe_nfe_infnfe_ide_nnf", "user_id", "tag_ids", "divergencia_peso_picking","x_studio_local_do_material"], order="scheduled_date asc, id asc")
                elif picking_type_id == 1200: # Etapa criada apenas para diferenciar a conferencia de separacao da separacao, que no Odoo são realizadas no mesmo picking_type_id (120)
                    pickings = client.execute("stock.picking", "search_read", [("picking_type_id", "=", 120), ("state", "in", ["assigned"]), ("tag_ids", "ilike", [32])], fields=["name", "origin", "partner_id", "state", "scheduled_date", "move_ids_without_package", "move_line_ids_without_package", "fotos_count", "pedido_compra_id", "pedido_venda_id", "parent_dfe_nfe_infnfe_ide_nnf", "user_id", "x_studio_local_do_material"], order="scheduled_date asc, id asc")
                elif picking_type_id == 139: # Conferencia da Expedicao
                    pickings = client.execute("stock.picking", "search_read", [("picking_type_id", "=", picking_type_id), ("state", "in", ["assigned"]), ("x_studio_local_definido", "=", True)], fields=["name", "origin", "partner_id", "state", "scheduled_date", "move_ids_without_package", "move_line_ids_without_package", "fotos_count", "pedido_compra_id", "pedido_venda_id", "parent_dfe_nfe_infnfe_ide_nnf", "user_id", "tag_ids","x_studio_local_do_material"], order="scheduled_date asc, id asc")
                elif picking_type_id == 1390: # Etapa criada apenas para diferenciar a conferencia da expedicao da armazenagem, que no Odoo são realizadas no mesmo picking_type_id (139)
                    pickings = client.execute("stock.picking", "search_read", [("picking_type_id", "=", 139), ("state", "in", ["assigned"]), ("x_studio_local_definido", "=", False)], fields=["name", "origin", "partner_id", "state", "scheduled_date", "move_ids_without_package", "move_line_ids_without_package", "fotos_count", "pedido_compra_id", "pedido_venda_id", "parent_dfe_nfe_infnfe_ide_nnf", "user_id", "tag_ids","x_studio_local_do_material"], order="scheduled_date asc, id asc")
            # Busca os pickings que estão aguardando para entrar na etapa
            waiting_picking_type_id = (
                120 if picking_type_id == 1200 else picking_type_id
            )

            waiting_pickings = client.execute(
                "stock.picking",
                "search_read",
                [
                    ("picking_type_id", "=", waiting_picking_type_id),
                    ("state", "=", "waiting"),
                ],
                fields=["id", "pedido_venda_id"],
            )

            # Conta quantos pickings waiting existem por Pedido de Venda
            waiting_counts_by_pv = defaultdict(int)

            for waiting_picking in waiting_pickings:
                pedido_venda = waiting_picking.get("pedido_venda_id")

                if pedido_venda:
                    pedido_venda_id = pedido_venda[0]
                    waiting_counts_by_pv[pedido_venda_id] += 1

            pedido_venda_ids = {
                picking["pedido_venda_id"][0]
                for picking in pickings
                if picking.get("pedido_venda_id")
            }
            total_counts_by_pv = defaultdict(int)
            conferido_counts_by_pv = defaultdict(int)

            if (
                picking_type_id == 1200 and
                pedido_venda_ids
            ):
                total_pickings = client.execute(
                    "stock.picking",
                    "search_read",
                    [
                        ("picking_type_id", "=", waiting_picking_type_id),
                        ("pedido_venda_id", "in", list(pedido_venda_ids)),
                        ("state", "!=", "cancel"),
                    ],
                    fields=["pedido_venda_id", "tag_ids"],
                )

                for total_picking in total_pickings:
                    pedido_venda = total_picking.get("pedido_venda_id")

                    if pedido_venda:
                        pedido_venda_id = pedido_venda[0]
                        total_counts_by_pv[pedido_venda_id] += 1

                        if 29 in total_picking.get("tag_ids", []):
                            conferido_counts_by_pv[pedido_venda_id] += 1

            move_ids = [move_id for picking in pickings for move_id in picking["move_ids_without_package"]]
            
            move_line_ids = [move_line_id for picking in pickings for move_line_id in picking["move_line_ids_without_package"]]
            
            move_lines_by_id = {}
            if move_line_ids:
                move_line_fields = ["id", "peso", "qty_done", "package_type_id", "lot_id", "product_uom_id", "referencia_interna"]
                move_lines = client.execute("stock.move.line", "search_read", [("id", "in", move_line_ids)], fields=move_line_fields)
                move_lines_by_id = {move_line["id"]: move_line for move_line in move_lines}
            
            moves_by_picking: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
            received_quantity_field = None
            if move_ids:
                move_fields = client.execute("stock.move", "fields_get")
                received_quantity_field = next((field for field in ("quantity", "quantity_done") if field in move_fields), None)
                fields = ["picking_id", "product_id", "product_uom_qty", "move_dest_ids"]
                if received_quantity_field is not None:
                    fields.append(received_quantity_field)
                moves = client.execute("stock.move", "search_read", [("id", "in", move_ids)], fields=fields)

                for move in moves:
                    moves_by_picking[move["picking_id"][0]].append(move)

        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível consultar os pickings da etapa solicitada")) from error

        destination_move_ids = list({
            move_dest_id
            for moves in moves_by_picking.values()
            for move in moves
            for move_dest_id in move.get("move_dest_ids", [])
        })
        destination_moves_by_id: Dict[int, Dict[str, Any]] = {}
        if destination_move_ids:
            destination_moves = client.execute("stock.move", "search_read", [("id", "in", destination_move_ids)], fields=["id", "location_dest_id"])
            destination_moves_by_id = {move["id"]: move for move in destination_moves}
    
        records = []
        for picking in pickings:
            moves = moves_by_picking[picking["id"]]
            product_names = [move["product_id"][1] for move in moves if move["product_id"]]
            expected_quantity = sum(move["product_uom_qty"] for move in moves)
            received_quantity = sum(move.get(received_quantity_field, 0) for move in moves)
            local = None
            if picking_type_id == 137:
                for move in moves:
                    for move_dest_id in move.get("move_dest_ids", []):
                        destination_move = destination_moves_by_id.get(move_dest_id, {})
                        location_dest = destination_move.get("location_dest_id")
                        if location_dest:
                            if isinstance(location_dest, (list, tuple)):
                                local = location_dest[1] if len(location_dest) > 1 else str(location_dest[0])
                            else:
                                local = str(location_dest)
                            break
                    if local:
                        break
            else:
                local = picking["x_studio_local_do_material"]    

            barcode_registered = bool(local)
            partner = picking["pedido_compra_id"]
            cliente = picking["partner_id"]
            nf_number = picking["parent_dfe_nfe_infnfe_ide_nnf"]

            photo_relation = picking.get("fotos_count") or []
            if isinstance(photo_relation, (list, tuple)):
                photo_count = len(photo_relation)
            else:
                photo_count = int(photo_relation or 0)
            
            record = {
                "nf_number": nf_number,
                "id": picking["id"],
                "pv": f'{picking["name"]} - NF {nf_number}' if nf_number else picking["name"],
                "reference": picking["name"],
                "client": (partner[1] if partner else "Sem fornecedor"),
                "partner": (cliente[1]) if cliente else "Sem cliente",
                "product": (", ".join(product_names) or "Sem produtos"),
                "expectedQuantity": expected_quantity,
                "receivedQuantity": received_quantity,
                "validated": (picking["state"] == "done"),
                "state": picking["state"],
                "scheduledDate": picking["scheduled_date"],
                "photoCount": photo_count,
                "photosRegistered": photo_count >= 3,
                "barcodeRegistered": bool(barcode_registered),
                "local": local,
                "cliente": (cliente[1] if cliente else "Cliente não definido"),
                "userId": (
                    picking["user_id"][0]
                    if picking.get("user_id")
                    else None
                ),

                "userName": (
                    picking["user_id"][1]
                    if picking.get("user_id")
                    else None
                ),
                "tagIds": picking.get("tag_ids", []),

                "pedido_venda_id": (
                    picking["pedido_venda_id"][0]
                    if picking.get("pedido_venda_id")
                    else None
                ),

                "pedido_venda_name": (
                    picking["pedido_venda_id"][1]
                    if picking.get("pedido_venda_id")
                    else None
                ),
                "move_line_ids_without_package": picking.get("move_line_ids_without_package", []),
                "move_lines": [move_lines_by_id[line_id] for line_id in picking.get("move_line_ids_without_package", []) if line_id in move_lines_by_id],

                "waitingCount": (
                    waiting_counts_by_pv.get(picking["pedido_venda_id"][0], 0)
                    if picking.get("pedido_venda_id")
                    else 0
                ),
                "totalPickingCount": (
                    total_counts_by_pv.get(picking["pedido_venda_id"][0], 0)
                    if picking.get("pedido_venda_id")
                    else 0
                ),
                "conferidoCount": (
                    conferido_counts_by_pv.get(
                        picking["pedido_venda_id"][0],
                        0,
                    )
                    if picking.get("pedido_venda_id")
                    else 0
                ),
                "divergencia_peso_picking": picking.get("divergencia_peso_picking", False),
            }

            result_package_ids = client.execute("stock.move.line", "search_read", [("id", "in", move_line_ids)], fields=["result_package_id", "picking_id"])
            if result_package_ids:
                for package in result_package_ids:
                    picking_id = package.get("picking_id")[0]
                    if picking_id == picking.get("id"):
                        if package.get("result_package_id"):
                            record["resultPackageName"] = package.get("result_package_id")[1]
                            break

            records.append(record)

        return {"picking_type_id": picking_type_id, "records": records}

    ####################################
    #  IMPRESSÃO DA ETIQUETA DE QUALIDADE ou SEPARAÇÃO
    ####################################
    #
    #  Solicita ao Odoo a geração do documento da etiqueta de qualidade/separacao
    #  para o picking informado.
    #
    # Após receber os dados do documento e da impressora, retorna os
    # dados para que o navegador envie o arquivo ao dispositivo IoT.
    #
    ####################################
    async def print_report(client, picking_id):
        try:
            print("==========================================")
            print("INÍCIO DA IMPRESSÃO")
            print("Picking ID:", picking_id)
            print("Client:", type(client))
            # ========================================================
            # CHAMA O IOT_RENDER DO ODOO
            # ========================================================
            print("Chamando ir.actions.report.iot_render...")
            picking_type_id = client.execute("stock.picking", "search_read", [("id", "=", picking_id)], fields=["picking_type_id"], limit=1)
            id_etiqueta = None
            if picking_type_id[0].get("picking_type_id")[0] == 137:
                id_etiqueta = 1202 # Etiqueta de Qualidade/Recebimento
            elif picking_type_id[0].get("picking_type_id")[0] == 120:
                id_etiqueta = 1367 # Etiqueta de Separação
            print("Etiqueta ID:", id_etiqueta)
            resultado = client.execute("ir.actions.report", "iot_render", id_etiqueta, [picking_id], {"device_id": "Qualidade - Argox OS-214EX PPLA"})
            print("Resultado recebido do Odoo:")
            print(resultado)
            # ========================================================
            # VALIDA RETORNO DO ODOO
            # ========================================================
            if not resultado:
                raise HTTPException(status_code=500, detail="O Odoo não retornou dados para impressão.")
            if not isinstance(resultado, (list, tuple)):
                raise HTTPException(status_code=500, detail=(f"Resposta inesperada do Odoo: " f"{type(resultado).__name__}"))
            if len(resultado) < 3:
                raise HTTPException(status_code=500, detail=(f"Resposta inválida do Odoo. " f"Esperado pelo menos 3 valores, " f"recebido: {len(resultado)}"))
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
                raise HTTPException(status_code=500, detail="O Odoo não retornou o endereço do IoT.")
            if not device_identifier:
                raise HTTPException(status_code=500, detail="O Odoo não retornou o identificador da impressora.")
            if not pdf_base64:
                raise HTTPException(status_code=500, detail="O Odoo não retornou o documento para impressão.")
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
            # RETORNA OS DADOS PARA O NAVEGADOR
            # ========================================================
            print("==========================================")
            print("DADOS DE IMPRESSÃO GERADOS COM SUCESSO")
            print("==========================================")
            return {
                "success": True,
                "message": "Dados da etiqueta gerados para impressão.",
                "picking_id": picking_id,
                "session_id": session_id,
                "iot_url": iot_url,
                "payload": payload,
            }
        # ============================================================
        # ERRO DO ODOO
        # ============================================================
        except xmlrpc.client.Fault as e:
            print("==========================================")
            print("ERRO XML-RPC DO ODOO")
            print(e)
            print("==========================================")
            raise HTTPException(status_code=502, detail=f"Erro ao executar impressão no Odoo: {str(e)}")
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
            raise HTTPException(status_code=500, detail=f"Erro ao imprimir etiqueta: {str(e)}")
   
    ####################################
    #  MÉTODO PARA VALIDAR PICKING
    ####################################
    #
    #  Executa a validação do picking no Odoo.
    #
    #  Utiliza o método de validação com possibilidade de backorder.
    #  Caso o Odoo valide o picking, mas apresente erro ao serializar
    #  o retorno, a operação é considerada concluída mesmo sem retorno.
    #
    ####################################
    def button_validate(client, picking_id):
        result = None
        try:
            result = client.execute("stock.picking", "action_validate_with_backorder", [picking_id])
        except xmlrpc.client.Fault as e:
            error_message = str(e)
            if "cannot marshal" in error_message:
                print("AVISO: O picking foi validado, mas não conseguiu serializar o retorno.")
                result = None
            else:
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
        return {"success": True, "picking_id": picking_id, "result": result}

    ####################################
    #  MÉTODO PARA FILTRAR PICKING POR NF
    ####################################
    #
    #  Consulta os pickings no Odoo utilizando o número da nota fiscal
    #  informado como filtro.
    #
    #  Retorna os registros encontrados diretamente para a camada que
    #  realizou a chamada do serviço.
    #
    ####################################
    def filter_nf(client, nf_number):
        try:
            result = client.execute("stock.picking", "search_read", [("parent_dfe_nfe_infnfe_ide_nnf", "=", nf_number)])
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível consultar os pickings com a origem solicitada")) from error
        return result

    ####################################
    #  MÉTODO PARA LISTAR CAUSAS DE NÃO CONFORMIDADE
    ####################################
    #
    #  Consulta no Odoo as causas de não conformidade cadastradas.
    #
    #  Os registros são retornados contendo o ID e o nome da causa,
    #  permitindo que sejam utilizados na criação de alertas de qualidade.
    #
    ####################################
    @staticmethod
    def list_quality_causes(client):
        try:
            causes = client.execute("x_causas_nao_conformid", "search_read", [], fields=["x_name"], order="x_name asc")
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível consultar " "as causas de não conformidade.")) from error

        return [
            {
                "id": cause["id"],
                "name": cause.get("x_name") or "Sem descrição"
            }
            for cause in causes
        ]

    ####################################
    #  MÉTODO PARA CRIAR ALERTA DE QUALIDADE
    ####################################
    #
    #  Cria um novo alerta de qualidade no Odoo utilizando os dados
    #  recebidos da aplicação.
    #
    #  Os dados são organizados no formato esperado pelo modelo
    #  quality.alert, incluindo as causas de não conformidade associadas.
    #
    ####################################
    def create_quality_alert(client, quality_alert_data):
        """
        Cria um alerta de qualidade no Odoo.
        """
        vals = {
            "picking_id": quality_alert_data.picking_id,
            "reprovacao": quality_alert_data.reprovacao,
            "quantidade_nao_conforme": quality_alert_data.quantidade_nao_conforme,
            "descricao_geral": quality_alert_data.descricao_geral,
            "especificado_quality": quality_alert_data.especificado_quality,
            "encontrado_quality": quality_alert_data.encontrado_quality,
            "causas_qa_id": [(6, 0, quality_alert_data.causas_qa_id)],
        }

        print(vals)

        try:
            quality_alert = client.execute("quality.alert", "create", [vals])
            return quality_alert
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Erro ao criar alerta de qualidade") from error

    ####################################
    #  MÉTODO PARA ATUALIZAR QUANTIDADE RECEBIDA
    ####################################
    #
    #  Atualiza no Odoo a quantidade efetivamente recebida em um picking.
    #
    #  Primeiro localiza as linhas de movimentação relacionadas ao picking.
    #  Em seguida, atualiza o campo qty_done dessas linhas com a quantidade
    #  recebida informada.
    #
    #  Caso nenhuma linha de movimentação seja encontrada, a operação
    #  é interrompida e retorna um erro.
    #
    ####################################
    def update_received_quantity(client, data):
        try:
            move_lines = client.execute("stock.move.line", "search", [("picking_id", "=", data.picking_id)])
            if not move_lines:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhuma linha de movimentação encontrada para o picking.")
            if len(move_lines) > 1:
                # Se tiver mais de uma move_line, faz o matching pelo ID da move_line específica.
                move_line = [move_line for move_line in move_lines if data.move_line_id == move_line]
                client.execute("stock.move.line", "write", move_line, {"qty_done": data.received_quantity})
            else:
                # Se tiver apenas uma move_line, atualiza diretamente.
                client.execute("stock.move.line", "write", move_lines, {"qty_done": data.received_quantity})
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            print(error)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Erro ao atualizar a quantidade " "de itens recebidos")) from error

    ####################################
    #  MÉTODO PARA ATUALIZAR Peso do Picking
    ####################################
    #
    #  Atualiza no Odoo o peso do picking.
    #
    #  Primeiro localiza as linhas de movimentação relacionadas ao picking.
    #  Em seguida, atualiza o campo peso dessas linhas com o peso
    #  informado.
    #
    #  Caso nenhuma linha de movimentação seja encontrada, a operação
    #  é interrompida e retorna um erro.
    #
    ####################################
    def update_peso_picking(client, data):
        try:
            move_lines = client.execute("stock.move.line", "search", [("picking_id", "=", data.get("picking_id"))])
            if not move_lines:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhuma linha de movimentação encontrada para o picking.")
            if len(move_lines) > 1:
                # Se tiver mais de uma move_line, faz o matching pelo ID da move_line específica.
                move_line = [move_line for move_line in move_lines if data.get("move_line_id") == move_line]
                client.execute("stock.move.line", "write", move_line, {"peso": data.get("peso_value")})
            else:
                # Se tiver apenas uma move_line, atualiza diretamente.
                client.execute("stock.move.line", "write", move_lines, {"peso": data.get("peso_value")})
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            print(error)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Erro ao atualizar a quantidade " "de itens recebidos")) from error


    ####################################
    #  MÉTODO PARA SALVAR FOTOS DO PICKING
    ####################################
    #
    #  Recebe as imagens em Base64 enviadas pelo frontend
    #  e cria um registro para cada foto no modelo
    #  stock.picking.picture.
    #
    #  As fotos somente chegam aqui quando o usuário
    #  confirma "REGISTRAR FOTOS".
    #
    ####################################
    @staticmethod
    def save_picking_photos(client, data):
        if not data.photos:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhuma foto foi enviada.")
        if len(data.photos) < 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="É necessário registrar pelo menos 3 fotos.")
        try:
            created_ids = []
            for photo in data.photos:
                if not photo:
                    continue
                image_base64 = photo
                # Remove o prefixo:
                # data:image/jpeg;base64,...
                # deixando somente o conteúdo Base64.
                if "," in image_base64:
                    image_base64 = image_base64.split(",", 1)[1]
                if not image_base64:
                    continue
                vals = {
                    "picking_id": data.picking_id,
                    "image": image_base64,
                }
                created_id = client.execute("stock.picking.picture", "create", [vals],)
                created_ids.append(created_id)
            if len(created_ids) < 3:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="É necessário registrar pelo menos 3 fotos válidas.")
            return {
                "success": True,
                "message": "Fotos registradas com sucesso.",
                "picking_id": data.picking_id,
                "photo_count": len(created_ids),
                "photo_ids": created_ids,
            }
        except HTTPException:
            raise
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            print("Erro ao executar stock.picking.picture.create:", error)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Erro ao registrar as fotos no Odoo.") from error


    @staticmethod
    def list_inventory_locations(client: OdooClient, picking_id):
        """
        Retorna os locais disponíveis para seleção manual.

        São considerados locais ativos utilizados na movimentação
        de estoque, incluindo locais internos e de trânsito.
        """

        picking_type_records = client.execute(
            "stock.picking",
            "search_read",
            [("id", "=", picking_id)],
            fields=["picking_type_id"],
            limit=1,
        )
        picking_type = (
            picking_type_records[0].get("picking_type_id")
            if picking_type_records
            else None
        )
        picking_type_id = (
            picking_type[0]
            if isinstance(picking_type, (list, tuple))
            else picking_type
        )
        centro_distruibuicao = 5963 if picking_type_id in [137, 138] else 11

        try:
            locations = client.execute("stock.location","search_read", [
                    ("active", "=", True),
                    ("usage", "in", ["internal", "transit"]),
                    ("location_id", "=", centro_distruibuicao)
            ],
            fields=[
                "id",
                "name",
                "complete_name",
                "barcode",
            ],
            order="complete_name asc, id asc",
            )

            return [
                {
                    "id": location["id"],
                    "name": (
                        location.get("complete_name")
                        or location.get("name")
                        or "Local sem nome"
                    ),
                    "barcode": location.get("barcode") or None,
                }
                for location in locations
            ]

        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível consultar os locais disponíveis.",
            ) from error


    @staticmethod
    def set_destination_location(client: OdooClient, picking_id: int, location_id: int):
        """
        Define manualmente o local de destino conforme a etapa do picking.

        O Recebimento Qualidade (137) grava o local nos movimentos da
        etapa seguinte (138). A etapa 139 grava o local nos
        próprios movimentos do picking.
        """

        try:
            updated_moves = []
            # Valida se o local escolhido existe no Odoo
            location_records = client.execute("stock.location", "search_read", [("id", "=", location_id)], fields=["id", "name", "complete_name"], limit=1)

            if not location_records:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local selecionado não foi encontrado.")

            location = location_records[0]

            # Verifica qual o tipo de operação do picking
            picking_type_records = client.execute("stock.picking", "search_read", [("id", "=", picking_id)], fields=["picking_type_id"], limit=1)
            
            if not picking_type_records:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Picking não encontrado.")
            
            picking_type_id = picking_type_records[0].get("picking_type_id")[0] if picking_type_records[0].get("picking_type_id") else None

            if picking_type_id == 137:
                # Se for Recebimento Qualidade (137), atualiza o local nos movimentos da etapa Estoque Transitório (138) - E uma ação automatizada valida automaticamente o estoque transitório.
                moves = client.execute("stock.move", "search_read", [("picking_id", "=", picking_id)], fields=["id", "move_dest_ids"])

                if not moves:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimentação não encontrada para este recebimento.")

                destination_move_ids = []

                for move in moves:
                    for destination_id in move.get("move_dest_ids") or []:
                        destination_move_ids.append(destination_id)

                destination_move_ids = list(dict.fromkeys(destination_move_ids))

                if not destination_move_ids:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhum movimento de destino encontrado para este recebimento.")

                client.execute("stock.move", "write", destination_move_ids, {"location_dest_id": location_id})

                # Verifica se a alteracao foi realizada com sucesso
                updated_moves = client.execute("stock.move", "read", destination_move_ids, fields=["id", "location_dest_id"])

            elif picking_type_id == 139:
                # Se for Conferência para Expedição (139), atualiza o local nos próprios movimentos do picking.
                move_lines = client.execute("stock.move.line", "search_read", [("picking_id", "=", picking_id)], fields=["id"])

                if not move_lines:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimentação não encontrada para este recebimento.")

                target_move_ids = list(dict.fromkeys(move_line["id"] for move_line in move_lines))

                client.execute("stock.move.line", "write", target_move_ids, {"location_dest_id": location_id})

                # Verifica se a alteração foi realizada com sucesso
                updated_moves = client.execute("stock.move.line", "read", target_move_ids, fields=["id", "location_dest_id"])

            local = None

            for move in updated_moves:
                location_dest = move.get("location_dest_id")

                if location_dest:
                    if isinstance(location_dest, (list, tuple)):
                        local = (location_dest[1] if len(location_dest) > 1 else str(location_dest[0])
                        )
                    else:
                        local = str(location_dest)

                    break

            return {
                "success": True,
                "picking_id": picking_id,
                "location_id": location_id,
                "picking_type_id": picking_type_id,
                "local": local,
            }

        except HTTPException:
            raise

        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível definir o local do recebimento.") from error


    @staticmethod
    def preencher_local_destino(client, picking_id, barcode):
        """
        Se for Recebimento Qualidade (137):
        Define o local da movimentação da etapa 138 a partir do código
        lido na etapa 137.
        Fluxo:

        stock.move da etapa 137
            -> move_dest_ids
                -> stock.move da etapa 138
                    -> location_dest_id
        Se for Conferencia para Expedição (139):
        Define o local de destino da propria etapa de conferência (139) a partir do código lido na etapa 139.
        """
        try:
            updated_move_ids = []

            location_records = client.execute("stock.location", "search_read", [("barcode", "=", barcode)], fields=["id", "name", "name"], limit=1)
            if not location_records:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local selecionado não foi encontrado.")

            location_id = location_records[0].get("id")

            picking_type_records = client.execute("stock.picking", "search_read", [("id", "=", picking_id)], fields=["picking_type_id"], limit=1)

            if not picking_type_records:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Picking não encontrado.")

            picking_type_id = picking_type_records[0].get("picking_type_id")[0] if picking_type_records[0].get("picking_type_id") else None

            if picking_type_id == 137:
                moves = client.execute("stock.move", "search_read", [("picking_id", "=", picking_id)], fields=["id", "move_dest_ids"])

                if not moves:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimentação não encontrada para este recebimento.")

                destination_move_ids = []

                for move in moves:
                    for destination_id in move.get("move_dest_ids") or []:
                        destination_move_ids.append(destination_id)

                destination_move_ids = list(dict.fromkeys(destination_move_ids))

                if not destination_move_ids:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhum movimento de destino encontrado para este recebimento.")

                client.execute("stock.move", "write", destination_move_ids, {"location_dest_id": location_id})

                updated_move_ids = destination_move_ids

            elif picking_type_id == 139:
                move_lines = client.execute("stock.move.line", "search_read", [("picking_id", "=", picking_id)], fields=["id"])

                if not move_lines:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimentação não encontrada para este recebimento.")

                target_move_ids = list(dict.fromkeys(move_line["id"] for move_line in move_lines))

                client.execute("stock.move.line", "write", target_move_ids, {"location_dest_id": location_id})

                updated_move_ids = target_move_ids

            updated_moves = client.execute("stock.move.line", "read", updated_move_ids, fields=["id", "location_dest_id"])
            local = None
            for move in updated_moves:
                location_dest = move.get("location_dest_id")
                if location_dest:
                    if isinstance(location_dest, list):
                        local = location_dest[1] if len(location_dest) > 1 else str(location_dest[0])
                    else:
                        local = str(location_dest)
                    break

            return {
                "success": True,
                "picking_id": picking_id,
                "barcode": barcode,
                "local": local,
            }

        except HTTPException:
            raise

        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível preencher o local de destino do recebimento.") from error

    ####################################
    #  CHAT DO RECEBIMENTO
    ####################################
    @staticmethod
    def list_chat_messages(client: OdooClient, picking_id: int):
        """
        Retorna o histórico de mensagens do Chatter do picking.
        """
        try:
            picking = client.execute("stock.picking", "search_read", [("id", "=", picking_id)], fields=["message_ids"], limit=1)
            if not picking:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Picking não encontrado.")
            message_ids = picking[0].get("message_ids") or []
            if not message_ids:
                return []
            messages = client.execute("mail.message", "search_read", [("id", "in", message_ids)], fields=["id", "body", "author_id", "date"], order="date asc, id asc")
            result = []
            for message in messages:
                body = message.get("body") or ""
                # O Chatter normalmente armazena o body como HTML.
                # Converte para texto simples para exibição no chat.
                body = re.sub(r"<[^>]+>", "", body)
                body = unescape(body).strip()
                if not body:
                    continue
                author = message.get("author_id")
                result.append({
                    "id": message["id"],
                    "text": body,
                    "author": author[1] if isinstance(author, (list, tuple)) and len(author) > 1 else "Sistema",
                    "date": message.get("date"),
                })
            return result
        except HTTPException:
            raise
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível consultar o histórico do chat.") from error

    @staticmethod
    def post_chat_message(client: OdooClient, picking_id: int, message: str,):
        """
        Publica uma mensagem no Chatter do picking.
        """
        message = (message or "").strip()
        if not message:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A mensagem não pode estar vazia.")
        try:
            picking = client.execute("stock.picking", "search_read", [("id", "=", picking_id)], fields=["id"], limit=1)
            if not picking:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Picking não encontrado.")
            client.execute("stock.picking", "message_post", [picking_id], body=message, message_type="comment", subtype_xmlid="mail.mt_comment")
            # Depois de gravar, consulta novamente o Chatter
            # para devolver o histórico atualizado ao frontend.
            messages = InventoryService.list_chat_messages(client, picking_id,)
            return {
                "success": True,
                "picking_id": picking_id,
                "messages": messages,
            }
        except HTTPException:
            raise
        except (KeyError, OSError, xmlrpc.client.Error) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Não foi possível registrar a mensagem no Chatter.") from error


    @staticmethod
    def list_active_responsible_users(client: OdooClient):
        """
        Retorna todos os usuários ativos do Odoo.

        Inicialmente não existe nenhum filtro adicional.
        Futuramente podemos restringir os usuários de acordo
        com algum grupo, função ou condição específica.
        """

        return client.execute(
            "res.users",
            "search_read",
            [("active", "=", True)],
            fields=[
                "id",
                "name",
            ],
            order="name asc, id asc",
        )


    @staticmethod
    def set_picking_responsible(
        client: OdooClient,
        picking_id: int,
        user_id: int,
    ):
        """
        Define o responsável pela separação no picking.

        O campo stock.picking.user_id é um Many2One
        relacionado ao modelo res.users.
        """

        users = client.execute(
            "res.users",
            "search_read",
            [
                ("id", "=", user_id),
                ("active", "=", True),
            ],
            fields=[
                "id",
                "name",
            ],
            limit=1,
        )

        if not users:
            raise ValueError(
                "O usuário selecionado não existe ou está inativo."
            )

        result = client.execute(
            "stock.picking",
            "write",
            [picking_id],
            {
                "user_id": user_id,
            },
        )

        if not result:
            raise ValueError(
                "Não foi possível definir o responsável pelo picking."
            )

        return {
            "success": True,
            "picking_id": picking_id,
            "user_id": user_id,
            "user_name": users[0]["name"],
        }

    def action_replicar_peso(client, data):
        try:
            wizard_replicar_peso_id = client.execute("stock.picking.peso.wizard", "create", [{
                'picking_id': data.get("picking_id"),
                'peso': data.get("peso"),
                }])
            result = client.execute("stock.picking.peso.wizard", "update_items", wizard_replicar_peso_id)
        except Exception as error:
            print(error)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível replicar o peso no Odoo")) from error

    def action_conferir_separacao(client, data):
        try:
            picking_id = data.get("picking_id")
            # Forma de executar uma ação no servidor do Odoo via XML-RPC:
            result = client.execute("ir.actions.server", "run", [2238], context = {
                                                                    "active_model": "stock.picking",
                                                                    "active_ids": [picking_id],
                                                                    "active_id": picking_id})
            return result
        except Exception as error:
            print(error)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível solicitar a conferencia de separação no Odoo")) from error

    def action_conferido_separacao(client, data):
        try:
            picking_id = data.get("picking_id")
            # Forma de executar uma ação no servidor do Odoo via XML-RPC:
            result = client.execute("ir.actions.server", "run", [1887], context = {
                                                                    "active_model": "stock.picking",
                                                                    "active_ids": [picking_id],
                                                                    "active_id": picking_id})
            return result
        except Exception as error:
            print(error)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível solicitar a conferencia de separação no Odoo")) from error

    def action_corrigir_peso_produto(client, data):
        try:
            picking_id = data.get("picking_id")
            # Chama o metodo que abre o wizard para corrigir o peso do produto no helpdesk do Odoo, e pega o contexto do wizard para criar o ticket no helpdesk.
            prepare_data = client.execute("stock.picking", "action_criar_ticket_helpdesk_peso", [picking_id])
            context = prepare_data["context"]

            ticket_id = client.execute("helpdesk.ticket", "create", [{
                "name": "Correção de Peso Produto",
                "team_id": context.get("default_team_id"),
                "picking_cpp_id": context.get("default_picking_cpp_id"),
                "peso_medido_cpp": context.get("default_peso_medido_cpp"),
                "produto_cpp_id": context.get("default_produto_cpp_id"),
                }])
        except Exception as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error))

    def action_local_definido(client, data):
        try:
            picking_id = data.get("picking_id")
            # Forma de executar uma ação no servidor do Odoo via XML-RPC:
            result = client.execute("ir.actions.server", "run", [1870], context = {
                                                                    "active_model": "stock.picking",
                                                                    "active_ids": [picking_id],
                                                                    "active_id": picking_id})
            return result
        except Exception as error:
            print(error)
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=("Não foi possível solicitar a conferencia de separação no Odoo")) from error
