(function () {
    "use strict";

    const inventory = window.AppInventory;
    let activePVKey = null;

    if (!inventory) {
        console.error(
            "O controlador compartilhado do inventario não foi carregado.",
        );
        return;
    }

    // Botao para realizar a Conferência de Separação
    function createConferenciaSeparacaoAction(context, picking) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "main-action conference-action";
        button.textContent = "✓ CONFERIR";

        button.addEventListener("click", async () => {
            if (inventory.isActionInProgress()) {
                return;
            }

            const confirmed = await window.AppUI.confirmAction({
                kicker: "CONFERÊNCIA",
                title: "CONFIRMAR CONFERÊNCIA",
                text: `Deseja realmente conferir o picking ${picking.pv}?`,
                confirmLabel: "CONFERIR",
            });
            if (!confirmed) {
                return;
            }

            try {
                await inventory.runAction(async () => {
                    const response = await fetch(
                        `/api/inventario/pickings/${picking.id}/conferido-separacao`,
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
                            "Não foi possível conferir a separação.",
                        );
                    }

                    inventory.showToast(
                        `Picking ${picking.pv} conferido com sucesso!`,
                    );

                    const remainingPickings = inventory
                        .getRecords()
                        .filter(
                            (record) =>
                                Number(record.id) !== Number(picking.id),
                        );

                    inventory.replaceRecords(remainingPickings);
                });
            } catch (error) {
                console.error(
                    "Erro ao conferir separação:",
                    error,
                );

                inventory.showToast(
                    error.message ||
                    "Não foi possível conferir a separação.",
                    "!",
                );
            }
        });

        return button;
    }

    function enhanceCard(card, picking, context) {
        // Herda o Card base e adiciona funcionalidades específicas para a separacao
        const clientInfo = context.main.querySelector(".client-info");
        const moveLines = picking.move_lines || [];
        const volumesCount = moveLines.length;
        const totalWeight = moveLines.reduce(
            (total, line) => total + (Number(line.peso) || 0),
            0,
        );

        if (clientInfo) {
            const packageInfo = createElement(
                "div",
                "package-info",
            );
            const packageLabel = createElement(
                "strong",
                "",
                "Volumes / Peso",
            );
            const packageValue = createElement(
                "h3",
                "",
                `${volumesCount} volumes / ${totalWeight.toFixed(2)} Kg`,
            );

            packageInfo.append(packageLabel, packageValue);
            clientInfo.replaceWith(packageInfo);
        }

        // Substitui as ações originais pelas específicas desta tela
        context.replacePrimaryActions([
            createConferenciaSeparacaoAction(context, picking),
            context.createQualityAction(),
        ]);
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function getUserGroupKey(record) {
        return record.userId
            ? String(record.userId)
            : "__NO_USER__";
    }

    function getPVGroupKey(record) {
        return record.pedido_venda_id
            ? String(record.pedido_venda_id)
            : "__NO_PV__";
    }

    function buildUserGroups(records) {
        const groupsByUser = new Map();

        for (const record of records) {
            const userKey = getUserGroupKey(record);

            if (!groupsByUser.has(userKey)) {
                groupsByUser.set(userKey, {
                    userName: record.userName || "SEM RESPONSÁVEL",
                    pvGroups: new Map(),
                });
            }

            const userGroup = groupsByUser.get(userKey);
            const pvKey = getPVGroupKey(record);

            if (!userGroup.pvGroups.has(pvKey)) {
                userGroup.pvGroups.set(pvKey, {
                    key: `${userKey}:${pvKey}`,
                    name: record.pedido_venda_name ||
                        (record.pedido_venda_id
                            ? `PV ${record.pedido_venda_id}`
                            : "SEM PEDIDO DE VENDA"),
                    clientName:
                        record.cliente || "Cliente não definido",
                    pickings: [],
                });
            }

            userGroup.pvGroups.get(pvKey).pickings.push(record);
        }

        return Array.from(groupsByUser.values());
    }

    function getPVCounts(group) {
        const pickings = group.pickings;
        const totalPickingCount = Number(
            pickings[0]?.totalPickingCount || 0,
        );
        const conferidoCount = Number(
            pickings[0]?.conferidoCount || 0,
        );
        const totalCount = totalPickingCount || pickings.length;

        return {
            conferidoCount,
            naoConferidoCount: Math.max(
                0,
                totalCount - conferidoCount,
            ),
            totalCount,
        };
    }

    function scrollToExpandedPV(pvCard) {
        requestAnimationFrame(() => {
            const topbar = document.querySelector(".topbar");
            const topbarHeight =
                topbar?.getBoundingClientRect().height || 0;

            const targetTop =
                pvCard.getBoundingClientRect().top +
                window.scrollY -
                topbarHeight -
                12;

            window.scrollTo({
                top: Math.max(0, targetTop),
                behavior: "smooth",
            });
        });
    }

    function createPVCard(group, cardsByRecordId) {
        const pvCard = createElement("section", "pv-card");
        const header = createElement("div", "pv-header");
        const title = createElement(
            "strong",
            "pv-title",
            `${group.name} - ${group.clientName}`,
        );
        const {
            conferidoCount,
            naoConferidoCount,
            totalCount,
        } = getPVCounts(group);
        const counter = createElement(
            "span",
            "pv-counter",
            `${conferidoCount}/${naoConferidoCount} - ${totalCount}`,
        );
        const pickingsList = createElement(
            "div",
            "pv-pickings hidden",
        );
        const toggleButton = createElement("button", "pv-toggle");
        const toggleIcon = createElement("span", "pv-toggle-icon", "▾");
        const isOpen = activePVKey === group.key;

        toggleButton.type = "button";
        toggleButton.setAttribute("aria-label", "Expandir pedido de venda");
        toggleButton.setAttribute("aria-expanded", "false");
        counter.setAttribute(
            "aria-label",
            `${conferidoCount} conferidos, ` +
            `${naoConferidoCount} não conferidos e ` +
            `${totalCount} itens no pedido`,
        );
        toggleButton.append(toggleIcon);

        header.append(title, counter);

        for (const picking of group.pickings) {
            const card = cardsByRecordId.get(String(picking.id));

            if (card) {
                pickingsList.append(card);
            }
        }

        function togglePV() {
            const willOpen = pickingsList.classList.contains("hidden");

            if (willOpen) {
                if (
                    activePVKey &&
                    activePVKey !== group.key
                ) {
                    return;
                }

                activePVKey = group.key;
                pickingsList.classList.remove("hidden");
                pvCard.classList.add("pv-focus-open");
                toggleIcon.textContent = "▴";
                toggleButton.setAttribute(
                    "aria-label",
                    "Recolher pedido de venda",
                );
                toggleButton.setAttribute("aria-expanded", "true");
                scrollToExpandedPV(pvCard);
                return;
            }

            activePVKey = null;
            pickingsList.classList.add("hidden");
            pvCard.classList.remove("pv-focus-open");
            toggleIcon.textContent = "▾";
            toggleButton.setAttribute(
                "aria-label",
                "Expandir pedido de venda",
            );
            toggleButton.setAttribute("aria-expanded", "false");
        }

        if (isOpen) {
            pickingsList.classList.remove("hidden");
            pvCard.classList.add("pv-focus-open");
            toggleIcon.textContent = "▴";
            toggleButton.setAttribute(
                "aria-label",
                "Recolher pedido de venda",
            );
            toggleButton.setAttribute("aria-expanded", "true");
        }

        toggleButton.addEventListener("click", (event) => {
            event.stopPropagation();
            togglePV();
        });

        pvCard.addEventListener("click", (event) => {
            if (
                event.target.closest(".picking-card") ||
                event.target.closest(".pv-toggle")
            ) {
                return;
            }

            togglePV();
        });

        pvCard.append(header, pickingsList, toggleButton);

        return pvCard;
    }

    function renderGroupedPickings(records) {
        const container = document.getElementById("pickingsContainer");

        if (!container) {
            return;
        }

        const cardsByRecordId = new Map(
            Array.from(
                container.querySelectorAll(".picking-card"),
            ).map((card) => [
                String(card.dataset.recordId),
                card,
            ]),
        );

        const userGroups = buildUserGroups(records);

        if (
            activePVKey &&
            !userGroups.some((userGroup) =>
                Array.from(userGroup.pvGroups.values()).some(
                    (pvGroup) => pvGroup.key === activePVKey,
                ))
        ) {
            activePVKey = null;
        }

        container.replaceChildren(
            ...userGroups.map((userGroup) => {
                const userCard = createElement(
                    "section",
                    "conference-user-group",
                );
                const userHeader = createElement(
                    "header",
                    "conference-user-header",
                );
                const userName = createElement(
                    "strong",
                    "conference-user-name",
                    userGroup.userName,
                );
                const userCount = createElement(
                    "span",
                    "conference-user-count",
                    `${Array.from(userGroup.pvGroups.values())
                        .reduce(
                            (count, pvGroup) =>
                                count + pvGroup.pickings.length,
                            0,
                        )} ITENS`,
                );
                const pvList = createElement(
                    "div",
                    "conference-user-pvs",
                );

                userHeader.append(userName, userCount);
                pvList.append(
                    ...Array.from(userGroup.pvGroups.values()).map(
                        (pvGroup) =>
                            createPVCard(
                                pvGroup,
                                cardsByRecordId,
                            ),
                    ),
                );
                userCard.append(userHeader, pvList);

                return userCard;
            }),
        );
    }

    inventory.configure({
        enhanceCard,
        onAfterRender: renderGroupedPickings,
    });
}());
