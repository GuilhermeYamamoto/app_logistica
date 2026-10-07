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
    let activePackageModal = null;
    let selectedPackage = null;

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

    async function getAvailablePackages() {
        const response = await fetch("/api/inventario/embalagens");

        if (!response.ok) {
            throw new Error("Não foi possível carregar as embalagens disponíveis.");
        }

        return await response.json();
    }

    async function gerarPacote(data) {
        const response = await fetch(
            "/api/inventario/gerar-pacote",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            }
        );

        if (!response.ok) {
            let detail =
                "Não foi possível gerar o pacote.";

            try {
                const errorData =
                    await response.json();

                detail =
                    errorData.detail || detail;
            } catch (error) {
                // Mantém a mensagem padrão.
            }

            throw new Error(detail);
        }

        return await response.json();
    }

    async function marcarMoveLinesParaPacote(
        moveLineIds
    ) {
        if (!moveLineIds?.length) {
            return;
        }

        const response = await fetch(
            "/api/inventario/marcar-para-pacote",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    move_line_ids: moveLineIds,
                }),
            }
        );

        if (!response.ok) {
            let detail =
                "Não foi possível marcar as linhas para pacote.";

            try {
                const errorData =
                    await response.json();

                detail =
                    errorData.detail || detail;
            } catch (error) {
                // Mantém a mensagem padrão.
            }

            throw new Error(detail);
        }

        return await response.json();
    }

    async function tirarMoveLinesDoPacote(
        moveLineIds
    ) {
        if (!moveLineIds?.length) {
            return;
        }

        const response = await fetch(
            "/api/inventario/tirar-do-pacote",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    move_line_ids: moveLineIds,
                }),
            }
        );

        if (!response.ok) {
            let detail =
                "Não foi possível remover as linhas do pacote.";

            try {
                const errorData =
                    await response.json();

                detail =
                    errorData.detail || detail;
            } catch (error) {
                // Mantém a mensagem padrão.
            }

            throw new Error(detail);
        }

        return await response.json();
    }

    function setupCheckboxChange(pickingsList) {
        pickingsList.addEventListener(
            "change",
            async (event) => {
                const checkbox =
                    event.target.closest(
                        ".emp-picking-checkbox"
                    );

                if (!checkbox) {
                    return;
                }

                const pickingItem =
                    checkbox.closest(
                        ".emp-picking-item"
                    );

                if (!pickingItem) {
                    return;
                }

                let moveLineIds = [];

                try {
                    moveLineIds = JSON.parse(
                        pickingItem.dataset.moveLineIds || "[]"
                    );
                } catch (error) {
                    console.error(
                        "Não foi possível ler as move lines do picking:",
                        error
                    );

                    checkbox.checked =
                        !checkbox.checked;

                    alert(
                        "Não foi possível identificar as linhas do picking."
                    );

                    return;
                }

                moveLineIds = moveLineIds
                    .map((id) => Number(id))
                    .filter(
                        (id) =>
                            Number.isInteger(id) &&
                            id > 0
                    );

                if (!moveLineIds.length) {
                    checkbox.checked =
                        !checkbox.checked;

                    alert(
                        "O picking selecionado não possui move lines."
                    );

                    return;
                }

                try {
                    if (checkbox.checked) {
                        await marcarMoveLinesParaPacote(
                            moveLineIds
                        );

                        console.log(
                            "Move lines marcadas para pacote:",
                            moveLineIds
                        );
                    } else {
                        await tirarMoveLinesDoPacote(
                            moveLineIds
                        );

                        console.log(
                            "Move lines removidas do pacote:",
                            moveLineIds
                        );
                    }
                } catch (error) {
                    console.error(
                        "Erro ao atualizar pacote das move lines:",
                        error
                    );

                    // Volta a checkbox para o estado anterior
                    // se o backend retornar erro.
                    checkbox.checked =
                        !checkbox.checked;

                    alert(
                        error.message ||
                        "Não foi possível atualizar o pacote."
                    );
                }
            }
        );
    }

    function closePackageModal() {
        if (!activePackageModal) {
            return;
        }

        activePackageModal.remove();

        activePackageModal = null;
        selectedPackage = null;

        document.body.classList.remove(
            "emp-modal-open"
        );
    }

    function markPickingsAsPacked(
        pickingsList,
        selectedPickings
    ) {
        const selectedPickingIds =
            new Set(
                selectedPickings.map(
                    (picking) => String(picking.id)
                )
            );

        const pickingItems =
            pickingsList.querySelectorAll(
                ".emp-picking-item"
            );

        pickingItems.forEach(
            (pickingItem) => {
                const pickingId =
                    pickingItem.dataset.pickingId;

                if (
                    !selectedPickingIds.has(
                        String(pickingId)
                    )
                ) {
                    return;
                }

                pickingItem.classList.add(
                    "emp-picking-packed"
                );

                const checkbox =
                    pickingItem.querySelector(
                        ".emp-picking-checkbox"
                    );

                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.disabled = true;
                }
            }
        );
    }

    async function openPackageModal(pvGroup, selectedPickings) {
        closePackageModal();

        selectedPackage = null;

        const modalOverlay =
            document.createElement("div");

        modalOverlay.className =
            "emp-package-modal-overlay";

        const modal =
            document.createElement("div");

        modal.className =
            "emp-package-modal";

        // =========================================
        // CABEÇALHO
        // =========================================

        const modalHeader =
            document.createElement("div");

        modalHeader.className =
            "emp-package-modal-header";

        const modalTitle =
            document.createElement("strong");

        modalTitle.className =
            "emp-package-modal-title";

        modalTitle.textContent =
            "Gerar pacote";

        const closeButton =
            document.createElement("button");

        closeButton.type = "button";

        closeButton.className =
            "emp-package-modal-close";

        closeButton.setAttribute(
            "aria-label",
            "Fechar"
        );

        closeButton.innerHTML = "×";

        closeButton.addEventListener(
            "click",
            closePackageModal
        );

        modalHeader.append(
            modalTitle,
            closeButton
        );

        // =========================================
        // CONTEÚDO
        // =========================================

        const modalContent =
            document.createElement("div");

        modalContent.className =
            "emp-package-modal-content";

        const instruction =
            document.createElement("p");

        instruction.className =
            "emp-package-modal-instruction";

        instruction.textContent =
            "Selecione a embalagem.";

        // =========================================
        // SELECT DE EMBALAGEM
        // =========================================

        const packageSelector =
            document.createElement("div");

        packageSelector.className =
            "emp-package-selector";

        packageSelector.setAttribute(
            "role",
            "button"
        );

        packageSelector.setAttribute(
            "tabindex",
            "0"
        );

        const packageSelectorText =
            document.createElement("span");

        packageSelectorText.className =
            "emp-package-selector-text";

        packageSelectorText.textContent =
            "Selecione a embalagem";

        const packageSelectorIcon =
            document.createElement("span");

        packageSelectorIcon.className =
            "emp-package-selector-icon";

        packageSelectorIcon.textContent =
            "▾";

        packageSelector.append(
            packageSelectorText,
            packageSelectorIcon
        );

        const packageOptions =
            document.createElement("div");

        packageOptions.className =
            "emp-package-options hidden";

        async function togglePackageOptions() {
            if (
                !packageOptions.classList.contains(
                    "hidden"
                )
            ) {
                packageOptions.classList.add(
                    "hidden"
                );

                return;
            }

            packageOptions.replaceChildren();

            packageSelectorText.textContent =
                "Carregando embalagens...";

            try {
                const availablePackages =
                    await getAvailablePackages();

                for (const packageData of availablePackages) {
                    const option =
                        document.createElement("button");

                    option.type = "button";

                    option.className =
                        "emp-package-option";

                    option.dataset.packageId =
                        String(packageData.id);

                    option.textContent =
                        packageData.name;

                    option.addEventListener(
                        "click",
                        (event) => {
                            event.stopPropagation();

                            selectedPackage =
                                packageData;

                            packageSelectorText.textContent =
                                packageData.name;

                            packageSelector.classList.add(
                                "has-selection"
                            );

                            packageOptions.classList.add(
                                "hidden"
                            );

                            finishPackageButton.disabled =
                                false;
                        }
                    );

                    packageOptions.appendChild(
                        option
                    );
                }

                packageSelectorText.textContent =
                    selectedPackage?.name ||
                    "Selecione a embalagem";

                packageOptions.classList.remove(
                    "hidden"
                );
            } catch (error) {
                console.error(
                    "Erro ao carregar embalagens:",
                    error
                );

                packageSelectorText.textContent =
                    "Erro ao carregar embalagens";
            }
        }

        packageSelector.addEventListener(
            "click",
            togglePackageOptions
        );

        packageSelector.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();

                    togglePackageOptions();
                }
            }
        );

        // =========================================
        // AÇÕES
        // =========================================

        const modalActions =
            document.createElement("div");

        modalActions.className =
            "emp-package-modal-actions";

        const cancelButton =
            document.createElement("button");

        cancelButton.type = "button";

        cancelButton.className =
            "emp-package-modal-cancel";

        cancelButton.textContent =
            "CANCELAR";

        cancelButton.addEventListener(
            "click",
            closePackageModal
        );

        const finishPackageButton =
            document.createElement("button");

        finishPackageButton.type = "button";

        finishPackageButton.className =
            "emp-package-modal-finish";

        finishPackageButton.textContent =
            "FINALIZAR";

        finishPackageButton.disabled =
            true;

        finishPackageButton.addEventListener(
            "click",
            async (event) => {
                event.stopPropagation();

                if (!selectedPackage) {
                    return;
                }

                const pickingIds =
                    selectedPickings
                        .map(
                            (picking) =>
                                Number(picking.id)
                        )
                        .filter(
                            (id) =>
                                Number.isInteger(id) &&
                                id > 0
                        );

                const moveLineIds =
                    selectedPickings
                        .flatMap(
                            (picking) =>
                                picking.move_lines || []
                        )
                        .map(
                            (moveLine) =>
                                Number(moveLine.id)
                        )
                        .filter(
                            (id) =>
                                Number.isInteger(id) &&
                                id > 0
                        );

                if (!pickingIds.length) {
                    alert(
                        "Nenhum picking foi selecionado."
                    );

                    return;
                }

                if (!moveLineIds.length) {
                    alert(
                        "Nenhuma move line foi encontrada nos pickings selecionados."
                    );

                    return;
                }

                const packagePayload = {
                    picking_ids:
                        pickingIds,

                    move_line_ids:
                        moveLineIds,

                    package_type_id:
                        Number(selectedPackage.id),
                };

                console.log(
                    "Payload enviado para gerar pacote:",
                    packagePayload
                );

                finishPackageButton.disabled =
                    true;

                finishPackageButton.textContent =
                    "GERANDO...";

                try {
                    const result =
                        await gerarPacote(
                            packagePayload
                        );

                    console.log(
                        "Pacote gerado com sucesso:",
                        result
                    );

                    /*
                    * Marca visualmente os pickings selecionados
                    * como empacotados somente depois que o Odoo
                    * confirmar a operação.
                    */
                    const activePVPickings =
                        activePVCard?.querySelector(
                            ".pv-pickings"
                        );

                    if (activePVPickings) {
                        markPickingsAsPacked(
                            activePVPickings,
                            selectedPickings
                        );
                    }

                    closePackageModal();

                } catch (error) {
                    console.error(
                        "Erro ao gerar pacote:",
                        error
                    );

                    alert(
                        error.message ||
                        "Não foi possível gerar o pacote."
                    );

                    finishPackageButton.disabled =
                        false;

                    finishPackageButton.textContent =
                        "FINALIZAR";
                }
            }
        );

        modalActions.append(
            cancelButton,
            finishPackageButton
        );

        // =========================================
        // MONTAGEM
        // =========================================

        modalContent.append(
            instruction,
            packageSelector,
            packageOptions
        );

        modal.append(
            modalHeader,
            modalContent,
            modalActions
        );

        modalOverlay.appendChild(modal);

        // Fecha clicando fora do modal.
        modalOverlay.addEventListener(
            "click",
            (event) => {
                if (event.target === modalOverlay) {
                    closePackageModal();
                }
            }
        );

        document.body.appendChild(
            modalOverlay
        );

        activePackageModal =
            modalOverlay;

        document.body.classList.add(
            "emp-modal-open"
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

                    // =========================
                    // BOTÃO CONCLUÍDO
                    // =========================

                    const completedButton =
                        document.createElement("button");

                    completedButton.type = "button";

                    completedButton.className =
                        "pv-completed-button";

                    completedButton.innerHTML = `
                        <span class="pv-completed-icon">✓</span>
                        <span>CONCLUÍDO</span>
                    `;

                    completedButton.setAttribute(
                        "aria-label",
                        "Concluir PV"
                    );

                    // Por enquanto, sem funcionalidade.
                    completedButton.addEventListener(
                        "click",
                        (event) => {
                            event.stopPropagation();
                        }
                    );

                    pvCard.appendChild(completedButton);

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

                            const selectedPickings =
                                group.pickings.filter(
                                    (picking, index) => {
                                        const pickingItems =
                                            pickingsList.querySelectorAll(
                                                ".emp-picking-item"
                                            );

                                        const checkbox =
                                            pickingItems[index]?.querySelector(
                                                ".emp-picking-checkbox"
                                            );

                                        return checkbox?.checked;
                                    }
                                );

                            openPackageModal(
                                group,
                                selectedPickings
                            );
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
                const pickingItem =
                    document.createElement("div");

                pickingItem.className =
                    "emp-picking-item";

                pickingItem.dataset.pickingId =
                    String(picking.id);

                pickingItem.dataset.moveLineIds =
                    JSON.stringify(
                        (picking.move_lines || [])
                            .map((moveLine) => moveLine.id)
                            .filter(Boolean)
                    );

                const checkbox =
                    document.createElement("input");

                checkbox.type = "checkbox";
                checkbox.className =
                    "emp-picking-checkbox";

                checkbox.checked =
                    (picking.move_lines || []).length > 0 &&
                    (picking.move_lines || []).every(
                        (moveLine) =>
                            moveLine.gerar_pacote === true
                    );

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
                    picking.move_lines?.[0]?.referencia_interna ||
                    "Sem produto";

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
                    (picking.move_lines?.[0]?.peso ?? "0") + " Kg";

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
                    picking.move_lines?.[0]?.lot_id?.[1] ?? "Sem lote";

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
                    picking.move_lines?.[0]?.qty_done ?? "0";

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

                pickingItem.addEventListener(
                    "click",
                    (event) => {
                        if (event.target === checkbox) {
                            return;
                        }

                        if (checkbox.disabled) {
                            return;
                        }

                        checkbox.checked =
                            !checkbox.checked;

                        checkbox.dispatchEvent(
                            new Event("change", {
                                bubbles: true,
                            })
                        );
                    }
                );
            }

            pvCard.appendChild(pickingsList);

            setupCheckboxChange(pickingsList);

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