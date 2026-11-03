
(function () {
    "use strict";

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

        // Fechar pelo X
        overlay.querySelector("#closeWeightModal")
            .addEventListener("click", closeModal);

        // Fechar pelo cancelar
        overlay.querySelector("#cancelWeight")
            .addEventListener("click", closeModal);

        // Fechar clicando fora do modal
        overlay.addEventListener("click", function (event) {
            if (event.target === overlay) {
                closeModal();
            }
        });

        // Fechar pelo ESC
        document.addEventListener("keydown", function (event) {
            if (
                event.key === "Escape" &&
                !overlay.classList.contains("hidden")
            ) {
                closeModal();
            }
        });

        // Confirmar peso
        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const weight = Number(input.value);

            if (!Number.isFinite(weight) || weight <= 0) {
                input.focus();
                return;
            }

            // Dispara evento para integração com a lógica da estocagem
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

    function enhanceCard(card, picking, context) {
        const quantityInput = context.main.querySelector(".quantity-input");
        if (quantityInput) {
            quantityInput.disabled = true;
            quantityInput.setAttribute("aria-disabled", "true");
            quantityInput.title = "Quantidade recebida somente visualização.";
        }

        const addPeso = document.createElement("button");

        // LINHA DE INFORMAÇÕES — PESO
        const weightInfoRow = document.createElement("div");
        weightInfoRow.className = "secondary-info-row";

        // PESO
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

        // Adiciona o campo à linha
        weightInfoRow.appendChild(weightBox);

        // Adiciona a nova linha ao card
        context.main.appendChild(weightInfoRow);

        addPeso.type = "button";

        addPeso.classList.add(
            "secondary-action",
            "package-action",
            "full-width-action"
        );

        addPeso.innerHTML =
            '<span class="action-icon-small">⚖️</span>ADICIONAR PESO';

        // Trava do botão CONCLUÍDO conforme o peso do picking.
        const validationAction = context.createValidationAction(
            undefined,
            totalWeight <= 1
        );

        context.replacePrimaryActions([
            addPeso,
            context.createQualityAction(),
            validationAction,
        ]);

        // Abre o modal ao clicar
        addPeso.addEventListener("click", function () {
            currentPicking = picking;

            const modal = createWeightModal();

            modal.classList.remove("hidden");

            modal.querySelector("#itemWeight").focus();
        });
    }

    const inventory = window.AppInventory;

    if (!inventory) {
        console.error(
            "O controlador compartilhado do inventário não foi carregado."
        );
        return;
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
