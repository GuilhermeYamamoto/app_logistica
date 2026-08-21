"""Serviço de inventário."""

from typing import Dict, List


class InventarioService:
    """Serviço responsável por lógica de inventário."""

    @staticmethod
    def get_inventory_stages() -> List[Dict[str, str]]:
        """Retorna as etapas de inventário."""
        return [
            {
                "key": "recebimento-fiscal",
                "name": "Recebimento Fiscal",
                "template": "inventario_etapa.html",
            },
            {
                "key": "recebimento-qualidade",
                "name": "Recebimento Qualidade",
                "template": "recebimento_qualidade.html",
            },
            {
                "key": "estoque-transitorio",
                "name": "Estoque Transitório",
                "template": "inventario_etapa.html",
            },
            {
                "key": "pre-separacao",
                "name": "Pré-Separação",
                "template": "inventario_etapa.html",
            },
            {
                "key": "separacao",
                "name": "Separação",
                "template": "inventario_etapa.html",
            },
            {
                "key": "empacotamento",
                "name": "Empacotamento",
                "template": "inventario_etapa.html",
            },
            {
                "key": "conferencia-expedicao",
                "name": "Conferencia Expedicao",
                "template": "inventario_etapa.html",
            },
        ]
