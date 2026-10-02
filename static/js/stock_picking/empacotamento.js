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

        // Pega os cards de picking que o AppInventory já criou.
        const existingCards = Array.from(
            container.querySelectorAll(".picking-card")
        );

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

            for (const picking of group.pickings) {
                const recordId =
                    String(
                        picking.id ||
                        picking.id === 0
                            ? picking.id
                            : ""
                    );

                let match = null;

                // Primeiro tenta localizar pelo recordId.
                if (recordId) {
                    match = existingCards.find(
                        (card) =>
                            String(
                                card.dataset.recordId || ""
                            ) === recordId
                    );
                }

                // Fallback caso o dataset não exista.
                if (!match) {
                    match = existingCards.find((card) => {
                        const refEl =
                            card.querySelector(
                                ".picking-identification strong"
                            );

                        if (!refEl) {
                            return false;
                        }

                        const text =
                            (refEl.textContent || "").trim();

                        const candidate =
                            String(
                                picking.pv ||
                                picking.reference ||
                                ""
                            ).trim();

                        return text === candidate;
                    });
                }

                if (match) {
                    // Remove apenas abas de chat do picking.
                    // A aba .picking-tab permanece.
                    try {
                        match
                            .querySelectorAll(
                                ".chat-tab:not(.picking-tab)"
                            )
                            .forEach((tab) => tab.remove());
                    } catch (error) {
                        // Não crítico.
                    }

                    pickingsList.appendChild(match);

                    const index =
                        existingCards.indexOf(match);

                    if (index >= 0) {
                        existingCards.splice(index, 1);
                    }
                }
            }

            pvCard.appendChild(pickingsList);

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

        // Segurança: se algum picking não foi
        // associado a um grupo, mantém no container.
        for (const leftover of existingCards) {
            container.appendChild(leftover);
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