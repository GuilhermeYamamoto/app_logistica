"""Router de recebimento de qualidade."""

import xmlrpc.client
from collections import defaultdict
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.core.security import get_odoo_client, get_odoo_credentials
from app.odoo.session import OdooCredentials

router = APIRouter(tags=["quality"])
templates = Jinja2Templates(directory=settings.TEMPLATES_DIR)

QUALITY_RECEIPT_PICKING_TYPE_ID = 137


@router.get("/recebimento-qualidade", response_class=HTMLResponse)
async def quality_page(
    request: Request,
    credentials: OdooCredentials = Depends(get_odoo_credentials),
):
    """Retorna página de recebimento de qualidade."""
    return templates.TemplateResponse(
        request=request,
        name="recebimento_qualidade.html",
    )


@router.get("/api/recebimento-qualidade/pickings")
async def list_quality_receipts(client=Depends(get_odoo_client)):
    """Lista os pickings do tipo de recebimento de qualidade."""
    try:
        pickings = client.execute(
            "stock.picking",
            "search_read",
            [
                ("picking_type_id", "=", QUALITY_RECEIPT_PICKING_TYPE_ID),
                ("state", "!=", "cancel"),
            ],
            fields=[
                "name",
                "origin",
                "partner_id",
                "state",
                "scheduled_date",
                "move_ids_without_package",
            ],
            limit=100,
            order="scheduled_date asc, id asc",
        )

        move_ids = [
            move_id
            for picking in pickings
            for move_id in picking["move_ids_without_package"]
        ]
        moves_by_picking: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        received_quantity_field = None

        if move_ids:
            move_fields = client.execute("stock.move", "fields_get")
            received_quantity_field = next(
                (
                    field
                    for field in ("quantity", "quantity_done")
                    if field in move_fields
                ),
                None,
            )
            fields = ["picking_id", "product_id", "product_uom_qty"]
            if received_quantity_field is not None:
                fields.append(received_quantity_field)

            moves = client.execute(
                "stock.move",
                "search_read",
                [("id", "in", move_ids)],
                fields=fields,
            )
            for move in moves:
                moves_by_picking[move["picking_id"][0]].append(move)
    except (KeyError, OSError, xmlrpc.client.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível consultar os recebimentos de qualidade no Odoo.",
        ) from error

    records = []
    for picking in pickings:
        moves = moves_by_picking[picking["id"]]
        product_names = [
            move["product_id"][1]
            for move in moves
            if move["product_id"]
        ]
        expected_quantity = sum(move["product_uom_qty"] for move in moves)
        received_quantity = sum(
            move.get(received_quantity_field, 0) for move in moves
        )
        partner = picking["partner_id"]

        records.append(
            {
                "id": picking["id"],
                "pv": picking["origin"] or picking["name"],
                "reference": picking["name"],
                "client": partner[1] if partner else "Sem fornecedor",
                "product": ", ".join(product_names) or "Sem produtos",
                "expectedQuantity": expected_quantity,
                "receivedQuantity": received_quantity,
                "validated": picking["state"] == "done",
                "state": picking["state"],
                "scheduledDate": picking["scheduled_date"],
            }
        )

    return {
        "picking_type_id": QUALITY_RECEIPT_PICKING_TYPE_ID,
        "records": records,
    }
