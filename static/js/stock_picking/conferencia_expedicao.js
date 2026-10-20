(function () {
    "use strict";

    const inventory = window.AppInventory;

    if (!inventory) {
        console.error(
            "O controlador compartilhado do inventário não foi carregado.",
        );
        return;
    }

    let activeGroupKey = null;
    let groupPendingValidation = null;
    let groupValidationModalInitialized = false;

    function formatNumber(value, maximumFractionDigits = 2) {
        return new Intl.NumberFormat("pt-BR", {
            maximumFractionDigits,
        }).format(Number(value) || 0);
    }

    function groupRecordsBySalesOrder(records) {
        const groups = new Map();

        for (const record of records || []) {
            const salesOrderId = record?.pedido_venda_id ?? null;
            const key = salesOrderId === null
                ? "__NO_SALES_ORDER__"
                : String(salesOrderId);

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    salesOrderId,
                    salesOrderName: record?.pedido_venda_name || null,
                    records: [],
                });
            }

            groups.get(key).records.push(record);
        }

        return Array.from(groups.values());
    }

    function getGroupSummary(group) {
        const volumeCount = group.records.reduce(
            (total, record) => total + Number(record.volumeCount || 0),
            0,
        );
        const totalWeight = group.records.reduce(
            (total, record) => total + Number(record.totalWeight || 0),
            0,
        );
        const stagePickingCount = Number(
            group.records[0]?.stagePickingCount || group.records.length,
        );
        const totalPickingCount = Number(
            group.records[0]?.totalPickingCount || stagePickingCount,
        );
        const locations = Array.from(
            new Set(
                group.records.flatMap((record) =>
                    Array.isArray(record.materialLocations)
                        ? record.materialLocations
                        : record.local
                            ? [record.local]
                            : [],
                ),
            ),
        );

        return {
            volumeCount,
            totalWeight,
            stagePickingCount,
            totalPickingCount,
            locations,
        };
    }

    function createSummaryField(label, value) {
        const field = document.createElement("div");
        field.className = "sales-order-summary-field";

        const fieldLabel = document.createElement("span");
        fieldLabel.className = "sales-order-summary-label";
        fieldLabel.textContent = label;

        const fieldValue = document.createElement("strong");
        fieldValue.className = "sales-order-summary-value";
        fieldValue.textContent = value;

        field.append(fieldLabel, fieldValue);
        return field;
    }

    async function executeSalesOrderGroupValidation(group, button) {
        groupPendingValidation = null;

        const modal = document.getElementById("groupValidationModal");
        const confirmButton = document.getElementById(
            "confirmGroupValidation",
        );

        if (
            inventory.isActionInProgress() ||
            !group.records.some((record) => !record.validated)
        ) {
            return;
        }

        const pendingRecords = group.records.filter(
            (record) => !record.validated,
        );
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = "VALIDANDO...";

        try {
            await inventory.runAction(async () => {
                if (!group.salesOrderId) {
                    throw new Error(
                        "Este agrupamento não possui Pedido de Venda.",
                    );
                }

                const response = await fetch(
                    `/api/inventario/pedidos-venda/${group.salesOrderId}/validar`,
                    {
                        method: "POST",
                    },
                );
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Não foi possível validar os pickings do Pedido de Venda.",
                    );
                }

                const validatedPickingIds = new Set(
                    (data.picking_ids || []).map(Number),
                );
                for (const record of pendingRecords) {
                    if (validatedPickingIds.has(Number(record.id))) {
                        record.validated = true;
                    }
                }
            });

            inventory.showToast(
                `${pendingRecords.length} PICKING(S) VALIDADO(S) COM SUCESSO`,
            );
        } catch (error) {
            console.error(
                "Erro ao validar os pickings do pedido:",
                error,
            );
            inventory.showToast(
                error.message ||
                "Não foi possível validar todos os pickings do pedido.",
                "!",
            );
        } finally {
            button.disabled = false;
            button.textContent = originalText;
            inventory.render();
        }

        if (modal) {
            window.AppUI.closeModal("groupValidationModal");
        }
        if (confirmButton) {
            confirmButton.disabled = false;
        }
    }

    function openSalesOrderValidation(group, button) {
        if (
            inventory.isActionInProgress() ||
            !group.records.some((record) => !record.validated)
        ) {
            return;
        }

        const salesOrderLabel = group.salesOrderName ||
            group.salesOrderId ||
            "sem pedido de venda";
        const validationText = document.getElementById(
            "groupValidationText",
        );

        if (!validationText) {
            return;
        }

        groupPendingValidation = { group, button };
        validationText.textContent =
            `Deseja validar todos os pickings do pedido ${salesOrderLabel}?`;
        window.AppUI.openModal("groupValidationModal");
    }

    function initializeGroupValidationModal() {
        if (groupValidationModalInitialized) {
            return;
        }

        const confirmButton = document.getElementById(
            "confirmGroupValidation",
        );
        if (!confirmButton) {
            return;
        }

        groupValidationModalInitialized = true;
        confirmButton.addEventListener("click", async () => {
            const pendingValidation = groupPendingValidation;

            if (!pendingValidation) {
                return;
            }

            confirmButton.disabled = true;
            await executeSalesOrderGroupValidation(
                pendingValidation.group,
                pendingValidation.button,
            );
        });

        document.addEventListener("app:modal-close", (event) => {
            if (event.detail?.id === "groupValidationModal") {
                groupPendingValidation = null;
                confirmButton.disabled = false;
            }
        });
    }

    function renderSalesOrderGroups(visibleRecords) {
        const container = document.getElementById("pickingsContainer");

        if (!container) {
            return;
        }

        const cardsById = new Map(
            Array.from(container.querySelectorAll(".picking-card")).map(
                (card) => [String(card.dataset.recordId), card],
            ),
        );
        const groups = groupRecordsBySalesOrder(visibleRecords);

        container.replaceChildren();

        for (const group of groups) {
            const salesOrderCard = document.createElement("section");
            salesOrderCard.className = "sales-order-card";
            salesOrderCard.dataset.salesOrderKey = group.key;

            const header = document.createElement("div");
            header.className = "sales-order-header";

            const title = document.createElement("span");
            title.className = "sales-order-title";
            const clientName = group.records[0]?.cliente ||
                "Cliente não definido";
            const salesOrderName = group.salesOrderName ||
                (group.salesOrderId
                    ? `PV ${group.salesOrderId}`
                    : "SEM PEDIDO DE VENDA");
            title.textContent = `${salesOrderName} - ${clientName}`;

            const headerActions = document.createElement("div");
            headerActions.className = "sales-order-header-actions";

            const validateButton = document.createElement("button");
            validateButton.type = "button";
            validateButton.className = "sales-order-validate";
            validateButton.textContent = "VALIDAR TODOS";
            validateButton.disabled =
                !group.salesOrderId ||
                !group.records.some((record) => !record.validated);

            const arrow = document.createElement("span");
            arrow.className = "sales-order-toggle";
            arrow.textContent = activeGroupKey === group.key ? "▲" : "▼";

            headerActions.append(validateButton, arrow);
            header.append(title, headerActions);

            const summary = getGroupSummary(group);
            const summaryGrid = document.createElement("div");
            summaryGrid.className = "sales-order-summary";
            summaryGrid.append(
                createSummaryField(
                    "Quantidade de Volumes",
                    formatNumber(summary.volumeCount, 0),
                ),
                createSummaryField(
                    "Peso Total",
                    `${formatNumber(summary.totalWeight)} kg`,
                ),
                createSummaryField(
                    "Total de itens",
                    `${formatNumber(summary.stagePickingCount, 0)}/${formatNumber(summary.totalPickingCount, 0)}`,
                ),
                createSummaryField(
                    "Local dos materiais",
                    summary.locations.length
                        ? summary.locations.join(", ")
                        : "Não definido",
                ),
            );

            const recordsContainer = document.createElement("div");
            recordsContainer.className = "sales-order-records";
            if (activeGroupKey !== group.key) {
                recordsContainer.classList.add("hidden");
            }

            for (const record of group.records) {
                const card = cardsById.get(String(record.id));
                if (card) {
                    recordsContainer.append(card);
                }
            }

            function toggleSalesOrderGroup() {
                activeGroupKey = activeGroupKey === group.key
                    ? null
                    : group.key;
                renderSalesOrderGroups(visibleRecords);
            }

            validateButton.addEventListener("click", (event) => {
                event.stopPropagation();
                openSalesOrderValidation(group, validateButton);
            });

            salesOrderCard.addEventListener("click", (event) => {
                if (
                    event.target.closest("button") ||
                    event.target.closest(".sales-order-records")
                ) {
                    return;
                }

                toggleSalesOrderGroup();
            });

            salesOrderCard.append(header, summaryGrid, recordsContainer);
            container.append(salesOrderCard);
        }
    }

    function enhanceCard(card, record, context) {
        const clientInfo = context.main.querySelector(".client-info");
        const label = clientInfo?.querySelector("strong");
        const value = clientInfo?.querySelector("h3");

        if (label) {
            label.textContent = "Cliente";
        }

        if (value) {
            value.textContent = record.cliente || "Cliente não definido";
        }

        context.replacePrimaryActions([
            context.createQualityAction(
                "main-action quality-action",
            ),
            context.createValidationAction(
                "main-action validation-action",
            ),
        ]);
    }

    inventory.configure({
        enhanceCard,
        onAfterRender: renderSalesOrderGroups,
    });

    initializeGroupValidationModal();
}());