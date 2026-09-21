(function () {
    "use strict";

    const elements = {
        records: document.getElementById("inventoryStageRecords"),
        container: document.getElementById("pickingsContainer"),
        emptyState: document.getElementById("emptyState"),
        section: document.getElementById("currentSection"),
        resultCount: document.getElementById("resultCount"),
        pendingCount: document.getElementById("pendingCount"),
        progressCount: document.getElementById("progressCount"),
        validationText: document.getElementById("validationText"),
        validationButton: document.getElementById("confirmValidation"),
        chatPanel: document.getElementById("chatPanel"),
        chatInfo: document.getElementById("chatPickingInfo"),
        chatMessages: document.getElementById("chatMessages"),
        chatForm: document.getElementById("chatForm"),
        chatInput: document.getElementById("chatInput"),
        chatCloseButton: document.getElementById("chatCloseButton"),
        qualityForm: document.getElementById("qualityForm"),
        qualityInfo: document.getElementById("qualityPickingInfo"),
        partialQuantityGroup: document.getElementById("partialQuantityGroup"),
        qualityCausesSelector: document.getElementById("causas_nao_conformidade"),
        qualityCausesDropdown: document.getElementById("causesDropdown"),
        qualityCausesList: document.getElementById("causesList"),
        selectedCauses: document.getElementById("selectedCauses"),
    };

    const options = {
        beforeValidate: async () => true,
        enhanceCard: () => {},
        getSectionTitle: (filter) => filter === "andamento"
            ? "REGISTROS EM ANDAMENTO"
            : "REGISTROS PENDENTES",
        getStatus: (record) => record.validated
            ? { label: "CONCLUÍDO", className: "status-completed" }
            : record.inProgress
                ? { label: "EM ANDAMENTO", className: "status-progress" }
                : { label: "PENDENTE", className: "status-waiting" },
        isInProgress: (record) => Boolean(record.inProgress),
        matchesRecord: () => true,
        normalizeRecord: (record) => record,
        onInitialized: () => {},
        onOpenValidation: () => {},
        onRecordsReplaced: () => {},
        refreshRecords: null,

        search: {
            onSearch: null,
            onClear: null,
        },

        resultText: (count) => `${count} ${count === 1 ? "registro" : "registros"}`,
        validateEndpoint: (record) => `/api/inventario/pickings/${record.id}/validar`,
        validationSuccessMessage: () => "REGISTRO VALIDADO COM SUCESSO",
        validationText: (record) => `Deseja realmente validar o registro ${record.pv || record.reference}?`,
        canEditQuantity: false,
    };

    let records = [];
    let filter = "pendentes";
    let initialized = false;
    let actionInProgress = false;
    let selectedValidationRecord = null;
    let selectedQualityRecord = null;
    let selectedChatRecord = null;
    let loadingRequests = 0;
    let qualityCauses = [];
    let selectedQualityCauses = [];

    const conversations = new Map();

    function configure(nextOptions) {
        Object.assign(options, nextOptions || {});
        if (initialized) {
            if (typeof options.refreshRecords === "function") {
                window.AppUI.setPullToRefreshHandler(runRefresh);
            }
            render();
        }
    }

    function formatCount(value) {
        return new Intl.NumberFormat("pt-BR", {
            notation: "compact",
            maximumFractionDigits: 2,
        }).format(value);
    }

    function getRecord(recordId) {
        return records.find((record) => Number(record.id) === Number(recordId));
    }

    function replaceRecords(nextRecords, { renderRecords = true } = {}) {
        if (!Array.isArray(nextRecords)) {
            throw new TypeError("Os registros da etapa têm formato inválido.");
        }

        records = nextRecords.map((record) => options.normalizeRecord({ ...record }));
        options.onRecordsReplaced(records);

        if (initialized && renderRecords) {
            render();
        }

        return records;
    }

    function recordMatchesFilter(record) {
        if (filter === "andamento") {
            return !record.validated && options.isInProgress(record);
        }

        return !record.validated;
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

    function createAction({
        className,
        label,
        icon,
        disabled = false,
        onClick,
        ariaLabel,
        title,
    }) {
        const button = createElement("button", className);

        button.type = "button";
        button.disabled = disabled;

        if (ariaLabel) {
            button.setAttribute("aria-label", ariaLabel);
        }

        if (title) {
            button.title = title;
        }

        if (icon) {
            button.append(
                createElement("span", "action-icon-small", icon),
            );
        }

        button.append(
            document.createTextNode(label),
        );

        button.addEventListener("click", onClick);

        return button;
    }

    function createValidationAction(
        record,
        className = "main-action validation-action",
        disabled = false,
    ) {
        return createAction({
            className,
            label: "VALIDAR",
            icon: "✓",
            disabled,
            onClick: () => openValidation(record),
        });
    }

    function createQualityAction(
        record,
        className = "main-action quality-action",
        disabled = false,
    ) {
        return createAction({
            className,
            label: "ALERTA DE QUALIDADE",
            icon: "⚠️",
            disabled,
            onClick: () => openQuality(record),
        });
    }

    function createCard(record) {
        const status = options.getStatus(record);

        const card = createElement(
            "article",
            `picking-card${record.validated ? " completed-card" : ""}`,
        );

        const hasMessages =
            (conversations.get(record.id) || []).length > 0;

        const chatTab = createAction({
            className: `chat-tab${hasMessages ? " has-messages" : ""}`,
            label: "💬",
            ariaLabel: "Abrir chat do registro",
            title: "Abrir chat",
            onClick: () => openChat(record),
        });

        const main = createElement("div", "picking-main");
        const identification = createElement("div", "picking-identification");

        const reference = createElement(
            "strong",
            "",
            record.pv || record.reference || "Sem referência",
        );

        const statusElement = createElement(
            "span",
            `picking-status ${status.className}`,
            status.label,
        );

        const supplier = createElement("div", "client-info");
        const product = createElement("div", "product-info");
        const quantity = createElement("div", "quantity-box");
        const primaryActions = createElement("div", "picking-actions");
        const secondaryActions = createElement(
            "div",
            "secondary-actions hidden",
        );
        
        const quantityInput = createElement("input", "quantity-input");
        quantityInput.type = "number";
        quantityInput.value = record.receivedQuantity;
        quantityInput.min = 0.0; 
        quantityInput.addEventListener("change", () => updateReceivedQuantity(record, quantityInput));
        quantityInput.disabled = !options.canEditQuantity;

        const expectedQuantity = createElement("span", "expected-quantity");
        expectedQuantity.textContent = `Esperado: ${record.expectedQuantity} unidades`;

        identification.append(
            reference,
            statusElement,
        );

        supplier.append(
            createElement(
                "strong",
                "",
                "Fornecedor",
            ),
            createElement(
                "h3",
                "",
                record.client || "Sem fornecedor",
            ),

        );

        quantity.append(
            createElement(
                "strong",
                "",
                "Quantidade Recebida",
            ),
            quantityInput,
            expectedQuantity,
        );

        product.append(
            createElement(
                "strong",
                "",
                "Produto",
            ),
            createElement(
                "h3",
                "",
                record.product || "Sem produtos",
            ),
        );
 
        main.append(
            identification,
            supplier,
            quantity,
            product,
        );

        primaryActions.append(
            createValidationAction(record),
            createQualityAction(record),
        );

        const context = {
            addSecondaryAction(action) {
                secondaryActions.classList.remove("hidden");
                secondaryActions.append(action);
                return action;
            },

            card,

            createAction,

            createQualityAction: (className, disabled) =>
                createQualityAction(record, className, disabled),

            createValidationAction: (className, disabled) =>
                createValidationAction(record, className, disabled),

            main,

            openChat: () =>
                openChat(record),

            openQuality: () =>
                openQuality(record),

            openValidation: () =>
                openValidation(record),

            primaryActions,

            replacePrimaryActions(actions) {
                primaryActions.replaceChildren(...actions);
            },

            secondaryActions,
        };

        options.enhanceCard(
            card,
            record,
            context,
        );

        card.append(
            chatTab,
            main,
            primaryActions,
            secondaryActions,
        );

        return card;
    }

    async function updateReceivedQuantity(record, input) {
        const value = Number(input.value);
        if (AppInventory.isActionInProgress()) {
            input.value = record.receivedQuantity;
            return;
        }
        if (Number.isNaN(value) || value < 0) {
            input.value = record.receivedQuantity;
            return;
        }

        const previousValue = record.receivedQuantity;
        record.receivedQuantity = value;
        try {
            await AppInventory.runAction(async () => {
                const response = await fetch("/api/received_quantity", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        picking_id: record.id,
                        received_quantity: value,
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.detail || "Erro ao atualizar quantidade.");
                }
                AppInventory.showToast("Quantidade atualizada.");
            });
        } catch (error) {
            console.error("Erro ao atualizar quantidade:", error);
            record.receivedQuantity = previousValue;
            AppInventory.showToast(error.message || "Erro ao atualizar quantidade.", "!");
        } finally {
            AppInventory.render();
        }
    }

    function showQuantityWarning(record) {
        const warning = document.getElementById("quantityWarning");
        warning?.classList.toggle(
            "hidden",
            !(Number(record.receivedQuantity) < Number(record.expectedQuantity)),
        );
    }



    function render() {
        if (!elements.container) {
            return;
        }

        const visibleRecords = records.filter((record) => (
            recordMatchesFilter(record) &&
            options.matchesRecord(record)
        ));

        elements.container.replaceChildren(
            ...visibleRecords.map(createCard),
        );

        if (elements.pendingCount) {
            elements.pendingCount.textContent = formatCount(
                records.filter(
                    (record) =>
                        !record.validated
                ).length,
            );
        }

        if (elements.progressCount) {
            elements.progressCount.textContent = formatCount(
                records.filter(
                    (record) =>
                        !record.validated &&
                        options.isInProgress(record),
                ).length,
            );
        }

        if (elements.section) {
            elements.section.textContent =
                options.getSectionTitle(filter);
        }

        if (elements.resultCount) {
            elements.resultCount.textContent =
                options.resultText(visibleRecords.length);
        }

        elements.emptyState?.classList.toggle(
            "hidden",
            visibleRecords.length > 0,
        );
    }

    function showLoading() {
        loadingRequests += 1;
        window.AppUI.showLoading();
    }

    function hideLoading() {
        loadingRequests = Math.max(
            0,
            loadingRequests - 1,
        );

        if (loadingRequests === 0) {
            window.AppUI.hideLoading();
        }
    }

    function showToast(message, icon = "✓") {
        window.AppUI.showToast(
            message,
            icon,
        );
    }

    function initializeSearch() {
        const searchInput = document.getElementById("searchInput");
        const searchButton = document.getElementById("searchButton");
        const clearSearch = document.getElementById("clearSearch");

        if (!searchInput || !clearSearch) {
            return;
        }

        const updateClearButton = () => {
            clearSearch.style.display =
                searchInput.value.trim() ? "block" : "none";
        };

        const search = () => {
            if (actionInProgress) {
                return;
            }

            const term = searchInput.value.trim();

            if (!term) {
                options.search.onClear?.();
                updateClearButton();
                return;
            }

            updateClearButton();
            options.search.onSearch?.(term);
        };

        searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                search();
            }
        });

        searchButton?.addEventListener("click", search);

        clearSearch.addEventListener("click", () => {
            if (actionInProgress) {
                return;
            }

            searchInput.value = "";
            updateClearButton();
            options.search.onClear?.();
            searchInput.focus();
        });

        updateClearButton();
    }

    async function runAction(operation) {
        if (actionInProgress) {
            return undefined;
        }

        actionInProgress = true;
        showLoading();

        try {
            return await operation();
        } finally {
            actionInProgress = false;
            hideLoading();
        }
    }

    function openValidation(record) {
        if (actionInProgress) {
            return;
        }

        selectedValidationRecord = record;

        options.onOpenValidation(record);

        showQuantityWarning(record);

        if (elements.validationText) {
            elements.validationText.textContent =
                options.validationText(record);
        }

        window.AppUI.openModal(
            "validationModal",
        );
    }

    async function validateSelectedRecord() {
        const record = selectedValidationRecord;

        if (!record || actionInProgress) {
            return;
        }

        if (!await options.beforeValidate(record)) {
            return;
        }

        const button = elements.validationButton;
        const originalText = button?.textContent;

        if (button) {
            button.disabled = true;
            button.textContent = "VALIDANDO...";
        }

        try {
            await runAction(async () => {
                const response = await fetch(
                    options.validateEndpoint(record),
                    {
                        method: "POST",
                    },
                );

                const data =
                    await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Não foi possível validar o registro.",
                    );
                }

                record.validated = true;

                window.AppUI.closeModal(
                    "validationModal",
                );

                render();

                showToast(
                    options.validationSuccessMessage(record),
                );
            });
        } catch (error) {
            console.error(
                "Erro ao validar registro:",
                error,
            );

            showToast(
                error.message ||
                "Não foi possível validar o registro.",
                "!",
            );
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalText;
            }
        }
    }

    function openQuality(record) {
        if (
            actionInProgress ||
            !elements.qualityForm
        ) {
            return;
        }

        selectedQualityRecord = record;

        if (elements.qualityInfo) {
            elements.qualityInfo.textContent =
                `${record.pv || record.reference} • ${record.product || ""}`;
        }

        elements.qualityForm.reset();

        selectedQualityCauses = [];

        elements.partialQuantityGroup?.classList.add(
            "hidden",
        );

        renderQualityCauses();

        window.AppUI.openModal(
            "qualityModal",
        );
    }

    async function submitQualityAlert(event) {
        event.preventDefault();

        const record = selectedQualityRecord;

        if (!record || actionInProgress) {
            return;
        }

        const rejection =
            document.querySelector(
                'input[name="reprovacao"]:checked',
            )?.value;

        const rejectedQuantity =
            Number(
                document.getElementById(
                    "quantidade_nao_conforme",
                )?.value,
            );

        const description =
            document.getElementById(
                "descricao_geral",
            )?.value.trim();

        if (
            !rejection ||
            !description ||
            (
                rejection === "parcial" &&
                rejectedQuantity <= 0
            )
        ) {
            showToast(
                "Preencha os campos obrigatórios do alerta.",
                "!",
            );

            return;
        }

        const payload = {
            picking_id: record.id,
            causas_qa_id: [...selectedQualityCauses],
            reprovacao: rejection,
            quantidade_nao_conforme:
                rejection === "parcial"
                    ? rejectedQuantity
                    : record.receivedQuantity,
            descricao_geral: description,
            especificado_quality:
                document.getElementById(
                    "especificado_quality",
                )?.value.trim() || "",
            encontrado_quality:
                document.getElementById(
                    "encontrado_quality",
                )?.value.trim() || "",
        };

        try {
            await runAction(async () => {
                const response = await fetch(
                    "/api/quality-alert",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(payload),
                    },
                );

                const data =
                    await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Não foi possível registrar o alerta de qualidade.",
                    );
                }

                record.qualityAlert = payload;

                window.AppUI.closeModal(
                    "qualityModal",
                );

                render();

                showToast(
                    "ALERTA DE QUALIDADE REGISTRADO",
                );
            });
        } catch (error) {
            console.error(
                "Erro ao registrar alerta de qualidade:",
                error,
            );

            showToast(
                error.message ||
                "Não foi possível registrar o alerta de qualidade.",
                "!",
            );
        }
    }

    async function loadQualityCauses() {
        if (!elements.qualityCausesList) {
            return;
        }

        elements.qualityCausesList.textContent =
            "CARREGANDO CAUSAS...";

        try {
            const response = await fetch(
                "/api/quality-alert/causas",
            );

            const data =
                await response.json().catch(() => null);

            if (
                !response.ok ||
                !Array.isArray(data)
            ) {
                throw new Error(
                    "Não foi possível carregar as causas.",
                );
            }

            qualityCauses = data;

            renderQualityCauses();

        } catch (error) {
            console.error(
                "Erro ao carregar causas:",
                error,
            );

            elements.qualityCausesList.textContent =
                "Não foi possível carregar as causas.";
        }
    }

    function renderQualityCauses() {
        if (!elements.qualityCausesList) {
            return;
        }

        elements.qualityCausesList.replaceChildren(
            ...qualityCauses.map((cause) => {
                const button = createElement(
                    "button",
                    "cause-option",
                );

                button.type = "button";

                button.classList.toggle(
                    "selected",
                    selectedQualityCauses.includes(
                        Number(cause.id),
                    ),
                );

                button.dataset.causeId =
                    cause.id;

                button.append(
                    createElement(
                        "span",
                        "cause-check",
                        "✓",
                    ),
                    createElement(
                        "span",
                        "cause-option-name",
                        cause.name,
                    ),
                );

                button.addEventListener(
                    "click",
                    (event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        const id =
                            Number(cause.id);

                        selectedQualityCauses =
                            selectedQualityCauses.includes(id)
                                ? selectedQualityCauses.filter(
                                    (item) => item !== id,
                                )
                                : [
                                    ...selectedQualityCauses,
                                    id,
                                ];

                        renderQualityCauses();
                    },
                );

                return button;
            }),
        );

        if (elements.selectedCauses) {
            const selected =
                selectedQualityCauses
                    .map((id) =>
                        qualityCauses.find(
                            (cause) =>
                                Number(cause.id) === id,
                        ),
                    )
                    .filter(Boolean)
                    .map((cause) =>
                        createElement(
                            "span",
                            "selected-cause",
                            cause.name,
                        ),
                    );

            elements.selectedCauses.replaceChildren(
                ...(selected.length
                    ? selected
                    : [
                        createElement(
                            "span",
                            "cause-placeholder",
                            "Selecione uma ou mais causas...",
                        ),
                    ]),
            );
        }
    }

    function toggleQualityCausesDropdown() {
        const dropdown =
            elements.qualityCausesDropdown;

        const selector =
            elements.qualityCausesSelector;

        if (!dropdown || !selector) {
            return;
        }

        const isOpening =
            dropdown.classList.contains("hidden");

        dropdown.classList.toggle(
            "hidden",
            !isOpening,
        );

        selector.classList.toggle(
            "open",
            isOpening,
        );
    }

    function closeQualityCausesDropdown() {
        elements.qualityCausesDropdown?.classList.add(
            "hidden",
        );

        elements.qualityCausesSelector?.classList.remove(
            "open",
        );
    }

    // ####################################
    // # CHAT DO RECEBIMENTO
    // ####################################

    async function openChat(record) {
        if (!record || !elements.chatPanel) {
            return;
        }

        selectedChatRecord = record;

        if (elements.chatInfo) {
            elements.chatInfo.textContent =
                `${record.pv || record.reference || ""} • ${record.product || ""}`;
        }

        if (elements.chatMessages) {
            elements.chatMessages.replaceChildren(
                createElement(
                    "div",
                    "chat-empty",
                    "CARREGANDO MENSAGENS...",
                ),
            );
        }

        elements.chatPanel.classList.remove(
            "hidden",
        );

        elements.chatPanel.setAttribute(
            "aria-hidden",
            "false",
        );

        try {
            const response = await fetch(
                `/api/inventario/pickings/${record.id}/chat`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                    },
                    cache: "no-store",
                },
            );

            const data =
                await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.detail ||
                    "Não foi possível carregar o histórico do chat.",
                );
            }

            const messages =
                Array.isArray(data)
                    ? data.map((message) => ({
                        id: message.id,
                        sender: "received",
                        author:
                            message.author ||
                            "Sistema",
                        text:
                            message.text ||
                            "",
                        date:
                            message.date ||
                            null,
                    }))
                    : [];

            conversations.set(
                record.id,
                messages,
            );

            renderChat();

            render();

        } catch (error) {
            console.error(
                "Erro ao carregar chat:",
                error,
            );

            conversations.set(
                record.id,
                [],
            );

            if (elements.chatMessages) {
                elements.chatMessages.replaceChildren(
                    createElement(
                        "div",
                        "chat-empty",
                        error.message ||
                        "Não foi possível carregar as mensagens.",
                    ),
                );
            }
        }

        setTimeout(() => {
            elements.chatInput?.focus();
        }, 100);
    }

    function closeChat() {
        selectedChatRecord = null;

        elements.chatPanel?.classList.add(
            "hidden",
        );

        elements.chatPanel?.setAttribute(
            "aria-hidden",
            "true",
        );
    }

    function renderChat() {
        if (
            !selectedChatRecord ||
            !elements.chatMessages
        ) {
            return;
        }

        const messages =
            conversations.get(
                selectedChatRecord.id,
            ) || [];

        elements.chatMessages.replaceChildren(
            ...messages.map((message) => {
                const item = createElement(
                    "div",
                    `chat-message ${
                        message.sender === "user"
                            ? "sent"
                            : "received"
                    }`,
                );

                const author =
                    message.author ||
                    (
                        message.sender === "user"
                            ? "Você"
                            : "Sistema"
                    );

                item.append(
                    createElement(
                        "span",
                        "chat-message-author",
                        author,
                    ),
                    createElement(
                        "span",
                        "chat-message-text",
                        message.text,
                    ),
                );

                return item;
            }),
        );

        if (messages.length === 0) {
            elements.chatMessages.append(
                createElement(
                    "div",
                    "chat-empty",
                    "Nenhuma mensagem ainda. Inicie uma conversa sobre este registro.",
                ),
            );
        }

        elements.chatMessages.scrollTop =
            elements.chatMessages.scrollHeight;
    }

    async function sendChatMessage() {
        if (
            !selectedChatRecord ||
            !elements.chatInput
        ) {
            return;
        }

        const text =
            elements.chatInput.value.trim();

        if (!text) {
            return;
        }

        if (actionInProgress) {
            return;
        }

        const pickingId =
            selectedChatRecord.id;

        elements.chatInput.disabled = true;

        try {
            const response = await fetch(
                `/api/inventario/pickings/${pickingId}/chat`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        message: text,
                    }),
                },
            );

            const data =
                await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.detail ||
                    "Não foi possível registrar a mensagem.",
                );
            }

            elements.chatInput.value = "";

            const messages =
                Array.isArray(data?.messages)
                    ? data.messages.map((message) => ({
                        id: message.id,
                        sender: "received",
                        author:
                            message.author ||
                            "Sistema",
                        text:
                            message.text ||
                            "",
                        date:
                            message.date ||
                            null,
                    }))
                    : [];

            conversations.set(
                pickingId,
                messages,
            );

            renderChat();

            render();

        } catch (error) {
            console.error(
                "Erro ao enviar mensagem:",
                error,
            );

            showToast(
                error.message ||
                "Não foi possível registrar a mensagem.",
                "!",
            );

        } finally {
            elements.chatInput.disabled = false;
            elements.chatInput.focus();
        }
    }

    async function runRefresh() {
        if (
            actionInProgress ||
            typeof options.refreshRecords !== "function"
        ) {
            return;
        }

        actionInProgress = true;

        try {
            await options.refreshRecords({
                getRecords: () => records,
                replaceRecords,
                render,
                showToast,
            });
        } finally {
            actionInProgress = false;
        }
    }

    function initializeQualityAlert() {
        document
            .querySelectorAll(
                'input[name="reprovacao"]',
            )
            .forEach((input) => {
                input.addEventListener(
                    "change",
                    () => {
                        elements.partialQuantityGroup?.classList.toggle(
                            "hidden",
                            input.value !== "parcial" ||
                            !input.checked,
                        );
                    },
                );
            });

        elements.qualityCausesSelector?.addEventListener(
            "click",
            toggleQualityCausesDropdown,
        );

        elements.qualityCausesSelector?.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();
                    toggleQualityCausesDropdown();
                }
            },
        );

        document.addEventListener(
            "click",
            (event) => {
                if (
                    elements.qualityCausesSelector &&
                    elements.qualityCausesDropdown &&
                    !elements.qualityCausesSelector.contains(
                        event.target,
                    ) &&
                    !elements.qualityCausesDropdown.contains(
                        event.target,
                    )
                ) {
                    closeQualityCausesDropdown();
                }
            },
        );

        elements.qualityForm?.addEventListener(
            "submit",
            submitQualityAlert,
        );

        loadQualityCauses();
    }

    function initialize() {
        if (initialized) {
            return;
        }

        initialized = true;

        try {
            const parsedRecords =
                JSON.parse(
                    elements.records?.textContent || "[]",
                );

            replaceRecords(
                parsedRecords,
                {
                    renderRecords: false,
                },
            );

        } catch (error) {
            console.error(
                "Registros de inventário inválidos:",
                error,
            );

            showToast(
                "Não foi possível carregar os registros.",
                "!",
            );
        }

        document
            .querySelectorAll(".dashboard-card")
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    () => {
                        if (actionInProgress) {
                            return;
                        }

                        filter =
                            button.dataset.filter;

                        document
                            .querySelectorAll(
                                ".dashboard-card",
                            )
                            .forEach((card) => {
                                card.classList.toggle(
                                    "active",
                                    card === button,
                                );
                            });

                        render();
                    },
                );
            });

        elements.validationButton?.addEventListener(
            "click",
            validateSelectedRecord,
        );

        elements.chatCloseButton?.addEventListener(
            "click",
            closeChat,
        );

        elements.chatForm?.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();
                sendChatMessage();
            },
        );

        initializeSearch();
        initializeQualityAlert();

        if (
            typeof options.refreshRecords === "function"
        ) {
            window.AppUI.setPullToRefreshHandler(
                runRefresh,
            );
        }

        options.onInitialized({
            getRecord,
            getRecords: () => records,
            render,
            replaceRecords,
        });

        render();
    }

    window.AppInventory = Object.freeze({
        configure,
        getRecord,
        getRecords: () => records,
        hideLoading,
        initialize,
        isActionInProgress: () => actionInProgress,
        openChat,
        openQuality,
        openValidation,
        render,
        replaceRecords,
        runAction,
        showLoading,
        showToast,
    });

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true,
            },
        );
    } else {
        initialize();
    }
}());
