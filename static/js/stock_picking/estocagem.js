
(function () {
    "use strict";

    const inventory = window.AppInventory;

    if (!inventory) {
        console.error("O controlador compartilhado do inventário não foi carregado.");
        return;
    }

    // Módulo JS para a estocagem
    let weightModal = null;
    let currentPicking = null;

    async function refreshStageRecords() {
        const stageKey = document.body.dataset.stageKey || "estocagem";
        const response = await fetch(
            `/api/inventario/pickings/refresh/${encodeURIComponent(stageKey)}?t=${Date.now()}`,
            {
                headers: { Accept: "application/json" },
                cache: "no-store",
            },
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(data?.records)) {
            throw new Error(
                data?.detail || "Não foi possível atualizar os registros da estocagem.",
            );
        }

        inventory.replaceRecords(data.records);
    }

    function getPickingMoveLineId(picking, fallbackId = null) {
        const moveLines = Array.isArray(picking?.move_lines)
            ? picking.move_lines
            : [];

        if (fallbackId !== null && fallbackId !== undefined) {
            return Number(fallbackId);
        }

        if (!moveLines.length) {
            return null;
        }

        const firstLine = moveLines[0];
        return Number(firstLine?.id ?? firstLine?.move_line_id ?? 0) || null;
    }

    function openPickingDetailsModal(pickingTarget) {
        const rowsContainer = document.getElementById("pickingDetailsRows");
        const title = document.getElementById("pickingDetailsTitle");
        const subtitle = document.getElementById("pickingDetailsSubtitle");
        const totalQty = document.getElementById("pickingDetailsTotalQty");
        const totalWeight = document.getElementById("pickingDetailsTotalWeight");
        const lotCount = document.getElementById("pickingDetailsLotCount");

        if (!rowsContainer || !title || !subtitle || !totalQty || !totalWeight || !lotCount) {
            return;
        }

        const targetMoveLines = pickingTarget.move_lines || [];
        const totalEmbalagens = targetMoveLines.length;
        const totalPeso = targetMoveLines.reduce(
            (sum, line) => sum + (Number(line.peso) || 0),
            0,
        );
        const uniqueLots = new Set(
            targetMoveLines
                .map((line) => line.lot_id ? String(line.lot_id[1] || "") : "")
                .filter(Boolean),
        );

        title.textContent = `PV ${pickingTarget.pv || pickingTarget.reference || "-"}`;
        subtitle.textContent = `${pickingTarget.pedido_venda_name || "Pedido"} / ${pickingTarget.cliente || "Cliente"}`;
        totalQty.textContent = String(totalEmbalagens);
        totalWeight.textContent = `${totalPeso.toFixed(2)} kg`;
        lotCount.textContent = String(uniqueLots.size);
        rowsContainer.innerHTML = "";

        if (targetMoveLines.length === 0) {
            rowsContainer.innerHTML = '<div class="picking-detail-empty">Nenhuma linha encontrada.</div>';
            window.AppUI.openModal("pickingDetailsModal");
            return;
        }

        targetMoveLines.forEach((line) => {
            const row = document.createElement("div");
            row.className = "picking-detail-row";

            const quantity = Number(line.qty_done) || Number(line.product_qty) || 0;
            const peso = Number(line.peso) || 0;
            const lot = line.lot_id ? line.lot_id[1] : "Não definido";

            row.innerHTML = `
                <div class="picking-detail-field quantity-field">
                    <input
                        class="detail-quantity-input"
                        type="number"
                        value="${quantity}"
                        step="0.01"
                        min="0"
                        disabled
                        readonly
                    >
                    <span class="detail-unit">CT</span>
                </div>
                <div class="picking-detail-field weight-field">
                    <input
                        class="detail-peso-input"
                        type="number"
                        value="${peso}"
                        step="0.01"
                        min="0"
                    >
                    <span class="detail-unit">Kg</span>
                </div>
                <div class="picking-detail-lot">${lot}</div>
            `;

            const pesoInput = row.querySelector(".detail-peso-input");
            const lineId = Number(line.id ?? line.move_line_id ?? getPickingMoveLineId(pickingTarget));

            pesoInput.addEventListener("change", () => {
                updatePesoValue(pickingTarget, pesoInput, lineId);
            });

            rowsContainer.appendChild(row);
        });

        window.AppUI.openModal("pickingDetailsModal");
    }

    async function updatePesoValue(picking, input, lineId = null) {
        const value = Number(input.value);

        if (!Number.isFinite(value) || value < 0) {
            input.value = Number(input.defaultValue || 0);
            return;
        }

        try {
            await inventory.runAction(async () => {
                const response = await fetch("/api/peso-value", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        picking_id: picking.id,
                        move_line_id: lineId ?? getPickingMoveLineId(picking),
                        peso_value: value,
                    }),
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.detail || "Erro ao atualizar peso.");
                }

                await refreshStageRecords();

                const updatedRecords = inventory.getRecords ? inventory.getRecords() : [];
                const updatedPicking = updatedRecords.find(
                    (record) => Number(record.id) === Number(picking.id),
                );

                if (updatedPicking) {
                    openPickingDetailsModal(updatedPicking);
                }

                inventory.showToast("Peso atualizado.");
            });
        } catch (error) {
            console.error("Erro ao atualizar peso:", error);
            inventory.showToast(
                error.message || "Erro ao atualizar peso.",
                "!",
            );
        }
    }

    function createWeightModal() {
        if (weightModal) {
            return weightModal;
        }

        const overlay = document.createElement("div");

        overlay.className = "modal-overlay hidden";
        overlay.id = "weightModal";

        overlay.innerHTML = `
            <div class="modal weight-modal">

                <div class="modal-header">
                    <div>
                        <span class="modal-kicker">
                            ESTOCAGEM
                        </span>

                        <h2>Adicionar peso</h2>

                        <p>
                            Informe o peso do item abaixo.
                        </p>
                    </div>

                    <button
                        type="button"
                        class="close-modal"
                        id="closeWeightModal"
                    >
                        ×
                    </button>
                </div>

                <form id="weightForm">

                    <div class="form-group">

                        <label for="itemWeight">
                            PESO DO ITEM (KG)
                        </label>

                        <input
                            type="number"
                            id="itemWeight"
                            name="weight"
                            placeholder="Ex: 15.500"
                            min="0"
                            step="0.001"
                            required
                        >

                    </div>

                    <div class="modal-footer">

                        <button
                            type="button"
                            class="secondary-button"
                            id="cancelWeight"
                        >
                            CANCELAR
                        </button>

                        <button
                            type="submit"
                            class="primary-button"
                        >
                            CONFIRMAR PESO
                        </button>

                    </div>

                </form>

            </div>
        `;

        document.body.appendChild(overlay);

        weightModal = overlay;

        overlay.addEventListener("weight:confirmed", handleWeightConfirmed);

        const input = overlay.querySelector("#itemWeight");
        const form = overlay.querySelector("#weightForm");

        function closeModal() {
            overlay.classList.add("hidden");
            form.reset();
        }

        overlay.querySelector("#closeWeightModal")
            .addEventListener("click", closeModal);

        overlay.querySelector("#cancelWeight")
            .addEventListener("click", closeModal);

        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) {
                closeModal();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (
                event.key === "Escape" &&
                !overlay.classList.contains("hidden")
            ) {
                closeModal();
            }
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const weight = Number(input.value);

            if (!Number.isFinite(weight) || weight <= 0) {
                input.focus();
                return;
            }

            overlay.dispatchEvent(
                new CustomEvent("weight:confirmed", {
                    bubbles: true,
                    detail: {
                        weight: weight
                    }
                })
            );

            closeModal();
        });

        return overlay;
    }

    async function handleWeightConfirmed(event) {
        const weight = Number(event.detail.weight);

        if (!currentPicking) {
            console.error("Nenhum picking selecionado para atualizar o peso.");
            return;
        }

        const moveLines = currentPicking.move_lines || [];
        const moveLineId = getPickingMoveLineId(currentPicking);

        if (!moveLines.length || moveLineId === null) {
            inventory.showToast(
                "Nenhuma linha de movimentação encontrada para este picking."
            );
            return;
        }

        try {
            await inventory.runAction(async () => {
                const response = await fetch("/api/peso-value", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        picking_id: currentPicking.id,
                        move_line_id: moveLineId,
                        peso_value: weight
                    })
                });

                const result = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        result.detail || "Erro ao atualizar o peso."
                    );
                }

                const targetLine = moveLines.find(
                    (line) => Number(line.id) === Number(moveLineId),
                );

                if (targetLine) {
                    targetLine.peso = weight;
                }

                currentPicking.totalWeight = moveLines.reduce(
                    (total, line) => total + Number(line.peso || 0),
                    0,
                );

                await refreshStageRecords();
                inventory.showToast("Peso atualizado com sucesso!");
            });

        } catch (error) {
            console.error("Erro ao atualizar peso:", error);

            inventory.showToast(
                error.message || "Não foi possível atualizar o peso no Odoo.",
                "!"
            );
        }
    }

    function normalizeTagIds(record) {
        const rawTagIds = Array.isArray(record?.tagIds)
            ? record.tagIds
            : Array.isArray(record?.tag_ids)
                ? record.tag_ids
                : [];

        return rawTagIds.map((tag) => {
            if (Array.isArray(tag)) {
                return Number(tag[0]);
            }

            if (tag && typeof tag === "object") {
                return Number(tag.id);
            }

            return Number(tag);
        }).filter((tagId) => Number.isFinite(tagId));
    }

    function hasTag(record, tagId) {
        return normalizeTagIds(record).includes(Number(tagId));
    }

    function isWeightDivergenceActive(picking) {
        const value = picking?.divergencia_peso_picking;

        if (typeof value === "string") {
            return ["1", "true", "yes", "y", "t"].includes(value.trim().toLowerCase());
        }

        if (typeof value === "number") {
            return value !== 0;
        }

        return Boolean(value);
    }

    function enhanceCard(card, picking, context) {
        const quantityInput = context.main.querySelector(".quantity-input");
        if (quantityInput) {
            quantityInput.disabled = true;
            quantityInput.setAttribute("aria-disabled", "true");
            quantityInput.title = "Quantidade recebida somente visualização.";
        }

        const correctionRequested = hasTag(picking, 34);
        if (correctionRequested) {
            card.classList.add("correction-requested");
            card.dataset.correctionRequested = "true";
        } else {
            card.classList.remove("correction-requested");
            delete card.dataset.correctionRequested;
        }

        const addPeso = document.createElement("button");

        const weightInfoRow = document.createElement("div");
        weightInfoRow.className = "secondary-info-row";

        const weightBox = document.createElement("div");
        weightBox.className = "weight-box";

        const weightLabel = document.createElement("div");
        weightLabel.className = "weight-label";
        weightLabel.textContent = "Peso";

        const weightValue = document.createElement("div");
        weightValue.className = "weight-value";

        const totalWeight = Number(picking.totalWeight || 0);

        weightValue.textContent = `${totalWeight.toLocaleString("pt-BR", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
        })} KG`;

        weightBox.appendChild(weightLabel);
        weightBox.appendChild(weightValue);
        weightInfoRow.appendChild(weightBox);
        context.main.appendChild(weightInfoRow);

        addPeso.type = "button";
        addPeso.classList.add(
            "secondary-action",
            "package-action",
            "full-width-action"
        );
        addPeso.innerHTML = '<span class="action-icon-small">⚖️</span>ADICIONAR PESO';

        const hasWeightDivergence = isWeightDivergenceActive(picking);

        const validationAction = context.createValidationAction(
            "main-action validation-action",
            hasWeightDivergence,
        );

        const qualityAction = context.createQualityAction();
        const primaryActions = [addPeso, qualityAction, validationAction];

        if (hasWeightDivergence) {
            const corrigirPesoDivergente = document.createElement("button");

            corrigirPesoDivergente.type = "button";
            corrigirPesoDivergente.className = "main-action correction-action";
            corrigirPesoDivergente.innerHTML =
                '<span class="action-icon-small">🛠️</span>SOLICITAR CORREÇÃO DE PESO';

            corrigirPesoDivergente.addEventListener(
                "click",
                async () => {
                    const confirmed = await window.AppUI.confirmAction({
                        kicker: "CORREÇÃO DE PESO",
                        title: "CORRIGIR PESO DIVERGENTE",
                        text: `Deseja solicitar a correção do peso divergente do picking ${picking.pv}?`,
                        confirmLabel: "CORRIGIR PESO",
                    });

                    if (!confirmed) {
                        return;
                    }

                    try {
                        await inventory.runAction(async () => {
                            const response = await fetch(
                                `/api/inventario/pickings/${picking.id}/corrigir-peso-divergente`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        picking_id: picking.id,
                                    }),
                                },
                            );

                            const data = await response.json().catch(() => ({}));

                            if (!response.ok) {
                                throw new Error(
                                    data.detail ||
                                        "Não foi possível abrir a solicitação de correção.",
                                );
                            }

                            const cardElement = corrigirPesoDivergente.closest(".picking-card");
                            if (cardElement) {
                                cardElement.classList.add("correction-requested");
                                cardElement.dataset.correctionRequested = "true";
                            }

                            if (!Array.isArray(picking.tagIds)) {
                                picking.tagIds = [];
                            }
                            if (!picking.tagIds.includes(34)) {
                                picking.tagIds.push(34);
                            }

                            picking.correcao_peso_solicitada = true;
                            picking.correcaoPesoSolicitada = true;
                            picking.peso_correcao_solicitada = true;

                            inventory.showToast(
                                `Solicitada Correção de peso do picking ${picking.pv} com sucesso!`,
                            );
                        });
                    } catch (error) {
                        console.error(
                            "Erro ao solicitar correcao de peso:",
                            error,
                        );
                        inventory.showToast(
                            error.message ||
                                "Não foi possível solicitar a correção do peso do produto.",
                            "!",
                        );
                    }
                },
            );

            primaryActions.splice(1, 0, corrigirPesoDivergente);
        }

        context.replacePrimaryActions(primaryActions);

        addPeso.addEventListener("click", function () {
            currentPicking = picking;
            const modal = createWeightModal();
            modal.classList.remove("hidden");
            modal.querySelector("#itemWeight").focus();
        });

        const detailsHint = document.createElement("button");
        detailsHint.type = "button";
        detailsHint.className = "picking-details-hint";
        detailsHint.innerHTML = '<span>👁️</span>VER DETALHES';
        detailsHint.setAttribute("aria-label", `Abrir detalhes do picking ${picking.pv || picking.reference || "-"}`);

        detailsHint.addEventListener("click", (event) => {
            event.stopPropagation();
            openPickingDetailsModal(picking);
        });

        card.appendChild(detailsHint);

        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Abrir detalhes do picking ${picking.pv || picking.reference || "-"}`);

        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPickingDetailsModal(picking);
            }
        });

        card.addEventListener("click", (event) => {
            if (
                event.target.closest("button") ||
                event.target.closest("input") ||
                event.target.closest("select") ||
                event.target.closest("textarea") ||
                event.target.closest("a")
            ) {
                return;
            }

            openPickingDetailsModal(picking);
        });
    }

    inventory.configure({
        enhanceCard,
        canEditQuantity: false,
        refreshRecords: async ({ replaceRecords, showToast }) => {
            try {
                const response = await fetch(
                    `/api/inventario/pickings/refresh/${encodeURIComponent(document.body.dataset.stageKey || "estocagem")}?t=${Date.now()}`,
                    {
                        headers: { Accept: "application/json" },
                        cache: "no-store",
                    },
                );
                const data = await response.json().catch(() => null);

                if (!response.ok || !Array.isArray(data?.records)) {
                    throw new Error(
                        data?.detail || "Não foi possível atualizar os registros da estocagem.",
                    );
                }

                replaceRecords(data.records);
            } catch (error) {
                console.error("Erro ao atualizar registros da estocagem:", error);
                showToast(
                    error.message || "Não foi possível atualizar os registros da estocagem.",
                    "!",
                );
            }
        },
    });
}());