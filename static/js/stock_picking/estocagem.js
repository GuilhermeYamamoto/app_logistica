
(function () {
    "use strict";

    // Módulo JS para a estocagem

    let weightModal = null;

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

    function enhanceCard(card, picking, context) {

        const addPeso = document.createElement("button");

        addPeso.type = "button";

        addPeso.classList.add(
            "secondary-action",
            "package-action",
            "full-width-action"
        );

        addPeso.innerHTML =
            '<span class="action-icon-small">⚖️</span>ADICIONAR PESO';

        context.replacePrimaryActions([
            addPeso,
            context.createQualityAction(),
            context.createValidationAction(),
        ]);

        // Abre o modal ao clicar
        addPeso.addEventListener("click", function () {

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
    });

}());
