(function () {
    "use strict";

    const inventory = window.AppInventory;

    if (!inventory) {
        console.error(
            "O controlador compartilhado do inventario não foi carregado."
        );
        return;
    }

    let pvGroups = [];
    let activePVCard = null;
    let isCheckboxDragSelecting = false;
    let checkboxDragPointerId = null;

    function enhanceCard(card, record, context) {
        context.replacePrimaryActions([]);
    }

    function scrollToExpandedPV(pvCard) {
        if (!pvCard) {
            return;
        }

        requestAnimationFrame(() => {
            const topbar = document.querySelector(".topbar");

            const topbarHeight =
                topbar?.getBoundingClientRect().height ||
                parseFloat(
                    getComputedStyle(document.documentElement)
                        .getPropertyValue("--topbar-height")
                ) ||
                0;

            const currentTop =
                pvCard.getBoundingClientRect().top +
                window.scrollY;

            const targetTop =
                currentTop -
                topbarHeight -
                12;

            window.scrollTo({
                top: Math.max(0, targetTop),
                behavior: "smooth",
            });
        });
    }

    function getFakePickingData(picking, index) {
        const fakeData = [
            {
                produto: "PXSO50CA",
                peso: "5,00 Kg",
                lote: "2926745904",
                quantidade: "3,00",
            },
            {
                produto: "PXSO60CA",
                peso: "8,50 Kg",
                lote: "2926745905",
                quantidade: "5,00",
            },
            {
                produto: "PXSO70CA",
                peso: "12,00 Kg",
                lote: "2926745906",
                quantidade: "8,00",
            },
            {
                produto: "PXSO80CA",
                peso: "6,75 Kg",
                lote: "2926745907",
                quantidade: "4,00",
            },
        ];

        return fakeData[index % fakeData.length];
    }

    function buildPVGroups(records) {
        const groupsById = new Map();

        for (const record of records || []) {
            const pvId = record?.pedido_venda_id ?? null;
            const key =
                pvId === null
                    ? "__NO_PV__"
                    : String(pvId);

            if (!groupsById.has(key)) {
                groupsById.set(key, {
                    pedido_venda_id: pvId,
                    pedido_venda_name:
                        record?.pedido_venda_name || null,
                    pickings: [],
                });
            }

            groupsById.get(key).pickings.push(record);
        }

        pvGroups = Array.from(groupsById.values());
    }

    function onRecordsReplaced(records) {
        buildPVGroups(records);

        setTimeout(() => {
            try {
                renderPVGroupsDOM();
            } catch (error) {
                console.error(
                    "Erro ao renderizar grupos de PV no empacotamento:",
                    error
                );
            }
        }, 0);
    }

    function setupCheckboxDragSelection(pickingsList) {
        let startCheckbox = null;
        let hasDragged = false;
        let suppressNextClick = false;
        let dragTargetState = null;

        pickingsList.addEventListener(
            "pointerdown",
            (event) => {
                const checkbox =
                    event.target.closest(
                        ".emp-picking-checkbox"
                    );

                if (!checkbox) {
                    return;
                }

                isCheckboxDragSelecting = true;
                checkboxDragPointerId = event.pointerId;
                startCheckbox = checkbox;
                hasDragged = false;

                // O arraste vai manter o mesmo estado
                // do primeiro checkbox.
                dragTargetState = !checkbox.checked;

                checkbox.setPointerCapture(
                    event.pointerId
                );
            }
        );

        pickingsList.addEventListener(
            "pointermove",
            (event) => {
                if (
                    !isCheckboxDragSelecting ||
                    event.pointerId !== checkboxDragPointerId
                ) {
                    return;
                }

                const element =
                    document.elementFromPoint(
                        event.clientX,
                        event.clientY
                    );

                const pickingItem =
                    element?.closest(
                        ".emp-picking-item"
                    );

                if (!pickingItem) {
                    return;
                }

                const checkbox =
                    pickingItem.querySelector(
                        ".emp-picking-checkbox"
                    );

                if (!checkbox) {
                    return;
                }

                // Verifica se realmente saiu da primeira caixa.
                if (checkbox !== startCheckbox) {
                    hasDragged = true;
                }

                // Quando realmente começou a arrastar,
                // aplica o mesmo estado do primeiro checkbox
                // em todos os checkboxes percorridos.
                if (hasDragged) {
                    startCheckbox.checked = dragTargetState;
                    checkbox.checked = dragTargetState;
                }
            }
        );

        pickingsList.addEventListener(
            "click",
            (event) => {
                const checkbox =
                    event.target.closest(
                        ".emp-picking-checkbox"
                    );

                if (!checkbox) {
                    return;
                }

                if (suppressNextClick) {
                    event.preventDefault();
                    event.stopPropagation();

                    suppressNextClick = false;
                }
            },
            true
        );

        const finishDragSelection = (event) => {
            if (
                !isCheckboxDragSelecting ||
                event.pointerId !== checkboxDragPointerId
            ) {
                return;
            }

            // Se houve arraste, o próximo CLICK nativo
            // precisa ser ignorado para não desmarcar
            // o primeiro checkbox.
            if (hasDragged) {
                suppressNextClick = true;
            }

            isCheckboxDragSelecting = false;
            checkboxDragPointerId = null;
            startCheckbox = null;
            hasDragged = false;
            dragTargetState = null;
        };

        pickingsList.addEventListener(
            "pointerup",
            finishDragSelection
        );

        pickingsList.addEventListener(
            "pointercancel",
            finishDragSelection
        );
    }

    function renderPVGroupsDOM() {
        const container =
            document.getElementById("pickingsContainer");

        if (!container) {
            return;
        }

        // Guarda qual PV estava aberto antes do render.
        const activePVKey =
            activePVCard?.dataset?.pvId || null;

        activePVCard = null;

        // Limpa o container para reconstruir a estrutura por PV.
        container.replaceChildren();

        for (const group of pvGroups) {
            const pvCard = document.createElement("section");
            pvCard.className = "pv-card";

            const pvKey =
                group.pedido_venda_id === null
                    ? "__NO_PV__"
                    : String(group.pedido_venda_id);

            pvCard.dataset.pvId = pvKey;

            const shouldRestoreOpen =
                activePVKey !== null &&
                activePVKey === pvKey;

            // =========================
            // HEADER DO PV
            // =========================

            const header =
                document.createElement("div");

            header.className = "pv-header";

            const left =
                document.createElement("div");

            left.className = "pv-header-left";

            const pvTitle =
                document.createElement("strong");

            pvTitle.className = "pv-title";

            pvTitle.textContent =
                group.pedido_venda_name ||
                (
                    group.pedido_venda_id
                        ? `PV ${group.pedido_venda_id}`
                        : "SEM PV"
                );

            left.appendChild(pvTitle);

            // =========================
            // AÇÕES DO PV
            // =========================

            const pvActions = document.createElement("div");
            pvActions.className = "pv-actions";


            // =========================
            // PV AINDA NÃO EMPACOTADO
            // =========================

            // BOTÃO EMPACOTAR

            const packageButton = document.createElement("button");

            packageButton.type = "button";
            packageButton.className =
                "pv-action-button pv-package-button";

            packageButton.setAttribute(
                "aria-label",
                "Empacotar PV"
            );

            packageButton.innerHTML = `
                <span class="pv-action-icon">📦</span>
                <span>EMPACOTAR</span>
            `;

            packageButton.addEventListener(
                "click",
                (event) => {
                    event.stopPropagation();

                    // Expande o PV.
                    expandPV();

                    // Remove EMPACOTAR e FINALIZAR.
                    pvActions.replaceChildren();

                    // Cria o botão GERAR PACOTE.
                    const generatePackageButton =
                        document.createElement("button");

                    generatePackageButton.type = "button";
                    generatePackageButton.className =
                        "pv-action-button pv-generate-package-button";

                    generatePackageButton.setAttribute(
                        "aria-label",
                        "Gerar pacote"
                    );

                    generatePackageButton.innerHTML = `
                        <span class="pv-action-icon">📦</span>
                        <span>GERAR PACOTE</span>
                    `;

                    generatePackageButton.addEventListener(
                        "click",
                        (event) => {
                            event.stopPropagation();

                            // Sem funcionalidade por enquanto.
                        }
                    );

                    pvActions.appendChild(
                        generatePackageButton
                    );
                }
            );

            // BOTÃO FINALIZAR

            const finishButton = document.createElement("button");

            finishButton.type = "button";
            finishButton.className =
                "pv-action-button pv-finish-button";

            finishButton.setAttribute(
                "aria-label",
                "Finalizar PV"
            );

            finishButton.innerHTML = `
                <span class="pv-action-icon">✓</span>
                <span>FINALIZAR</span>
            `;

            finishButton.addEventListener(
                "click",
                (event) => {
                    event.stopPropagation();
                }
            );

            pvActions.append(
                packageButton,
                finishButton,
            );

            header.append(
                left,
                pvActions,
            );

            pvCard.appendChild(header);

            // =========================
            // LISTA DE PICKINGS
            // =========================

            const pickingsList =
                document.createElement("div");

            pickingsList.className =
                shouldRestoreOpen
                    ? "pv-pickings"
                    : "pv-pickings hidden";

            for (
                const [index, picking]
                of group.pickings.entries()
            ) {
                const fakeData =
                    getFakePickingData(picking, index);

                const pickingItem =
                    document.createElement("div");

                pickingItem.className =
                    "emp-picking-item";

                const checkbox =
                    document.createElement("input");

                checkbox.type = "checkbox";
                checkbox.className =
                    "emp-picking-checkbox";

                checkbox.setAttribute(
                    "aria-label",
                    `Selecionar picking ${index + 1}`
                );

                const info =
                    document.createElement("div");

                info.className =
                    "emp-picking-info";

                // PRIMEIRA LINHA

                const firstRow =
                    document.createElement("div");

                firstRow.className =
                    "emp-picking-row";

                const product =
                    document.createElement("div");

                product.className =
                    "emp-picking-field";

                const productLabel =
                    document.createElement("span");

                productLabel.className =
                    "emp-picking-label";

                productLabel.textContent =
                    "Produto";

                const productValue =
                    document.createElement("strong");

                productValue.className =
                    "emp-picking-value";

                productValue.textContent =
                    fakeData.produto;

                product.append(
                    productLabel,
                    productValue
                );

                const weight =
                    document.createElement("div");

                weight.className =
                    "emp-picking-field";

                const weightLabel =
                    document.createElement("span");

                weightLabel.className =
                    "emp-picking-label";

                weightLabel.textContent =
                    "Peso";

                const weightValue =
                    document.createElement("strong");

                weightValue.className =
                    "emp-picking-value";

                weightValue.textContent =
                    fakeData.peso;

                weight.append(
                    weightLabel,
                    weightValue
                );

                firstRow.append(
                    product,
                    weight
                );

                // SEGUNDA LINHA

                const secondRow =
                    document.createElement("div");

                secondRow.className =
                    "emp-picking-row";

                const lot =
                    document.createElement("div");

                lot.className =
                    "emp-picking-field";

                const lotLabel =
                    document.createElement("span");

                lotLabel.className =
                    "emp-picking-label";

                lotLabel.textContent =
                    "Lote";

                const lotValue =
                    document.createElement("strong");

                lotValue.className =
                    "emp-picking-value";

                lotValue.textContent =
                    fakeData.lote;

                lot.append(
                    lotLabel,
                    lotValue
                );

                const quantity =
                    document.createElement("div");

                quantity.className =
                    "emp-picking-field";

                const quantityLabel =
                    document.createElement("span");

                quantityLabel.className =
                    "emp-picking-label";

                quantityLabel.textContent =
                    "Quantidade";

                const quantityValue =
                    document.createElement("strong");

                quantityValue.className =
                    "emp-picking-value";

                quantityValue.textContent =
                    fakeData.quantidade;

                quantity.append(
                    quantityLabel,
                    quantityValue
                );

                secondRow.append(
                    lot,
                    quantity
                );

                info.append(
                    firstRow,
                    secondRow
                );

                pickingItem.append(
                    checkbox,
                    info
                );

                pickingsList.appendChild(
                    pickingItem
                );
            }

            pvCard.appendChild(pickingsList);
            setupCheckboxDragSelection(pickingsList);

            if (shouldRestoreOpen) {
                pvCard.classList.add("pv-focus-open");
                activePVCard = pvCard;
            }

            // =========================
            // EXPANDIR / RECOLHER PV
            // =========================

            function expandPV() {
                const isOpen =
                    !pickingsList.classList.contains("hidden");

                // Se já estiver aberto, não faz nada.
                if (isOpen) {
                    return;
                }

                // Não permite abrir outro PV enquanto
                // já existe um PV aberto.
                if (
                    activePVCard &&
                    activePVCard !== pvCard
                ) {
                    return;
                }

                // Abre o PV.
                activePVCard = pvCard;

                pickingsList.classList.remove(
                    "hidden"
                );

                pvCard.classList.add(
                    "pv-focus-open"
                );

                scrollToExpandedPV(pvCard);
            }

            container.appendChild(pvCard);
        }
    }

    function handleAfterRender() {
        try {
            const records =
                window.AppInventory.getRecords
                    ? window.AppInventory.getRecords()
                    : [];

            buildPVGroups(records);
            renderPVGroupsDOM();
        } catch (error) {
            console.error(
                "Erro ao processar renderização dos PVs no empacotamento:",
                error
            );
        }
    }

    inventory.configure({
        onRecordsReplaced,
        onAfterRender: handleAfterRender,
        enhanceCard,
    });
}());