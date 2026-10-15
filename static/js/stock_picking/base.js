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
        readyToPrintCount: document.getElementById("readyToPrintCount"),
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
        getSectionTitle: (filter) => {
            if (filter === "andamento") {
                return "REGISTROS EM ANDAMENTO";
            }

            if (filter === "pronto-para-imprimir") {
                return "REGISTROS PRONTOS PARA IMPRIMIR";
            }

            return "REGISTROS PENDENTES";
        },
        getStatus: (record) => record.validated
            ? { label: "CONCLUÍDO", className: "status-completed" }
            : record.inProgress
                ? { label: "EM ANDAMENTO", className: "status-progress" }
                : { label: "PENDENTE", className: "status-waiting" },
        isInProgress: (record) => Boolean(record.inProgress),
        isPending: (record) => !record.validated,
        matchesRecord: () => true,
        isReadyToPrint: () => false,
        getReadyToPrintCount: (records) => records.filter(
            (record) => options.isReadyToPrint(record),
        ).length,
        normalizeRecord: (record) => record,
        onInitialized: () => {},
        onOpenValidation: () => {},
        onRecordsReplaced: () => {},
        onAfterRender: null,
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

        if (filter === "pronto-para-imprimir") {
            return options.isReadyToPrint(record);
        }

        return options.isPending(record);
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

    function updateValidationButtonsState(card, record) {
        const shouldDisable = Number(record.receivedQuantity) <= 0;

        card?.querySelectorAll(".validation-action").forEach((button) => {
            const baseDisabled = button.dataset.baseDisabled === "true";
            button.disabled = baseDisabled || shouldDisable;
        });
    }

    function createValidationAction(
        record,
        className = "main-action validation-action",
        disabled = false,
    ) {
        const button = createAction({
            className,
            label: "CONCLUÍDO",
            icon: "✓",
            disabled,
            onClick: () => openValidation(record),
        });
        button.dataset.baseDisabled = String(disabled);
        return button;
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
        quantityInput.addEventListener("input", () => {
            const value = Number(quantityInput.value);
            if (Number.isNaN(value) || value < 0) {
                quantityInput.value = record.receivedQuantity;
                return;
            }

            record.receivedQuantity = value;
            updateValidationButtonsState(card, record);
        });
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
        updateValidationButtonsState(card, record);

        card.append(
            chatTab,
            main,
            primaryActions,
            secondaryActions,
        );

        // Expor o id do registro no DOM para permitir que etapas externas
        // (como pre_separacao) localizem e movam os cards sem depender de
        // parsers de texto. Valor como string por consistência.
        try {
            card.dataset.recordId = String(record.id || '');
        } catch (e) {
            // não crítico — apenas log para depuração
            console.warn('Não foi possível definir data-record-id no card:', e);
        }

        return card;
    }

    async function updateReceivedQuantity(record, input, moveLineId = null) {
        /* O moveLineId está como opcional pois, até a etapa da Pré-Separação, não tem split de pacotes, ou seja, só tem uma linha de movimento de estoque, e após a Separacao ocorre o split, sendo assim pode haver mais de uma linha, que quando alterada, deve alterar a respectiva move_line_id no Odoo. Basicamente a regra vai ser, se não passar o moveLineId, realiza a movimentacao na primeira move_line (só vai ter uma), se passar o moveLineId, altera a respectiva move_line_id no Odoo*/
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
        const card = document.querySelector(`[data-record-id="${String(record.id)}"]`);
        updateValidationButtonsState(card, record);

        try {
            await AppInventory.runAction(async () => {
                const response = await fetch("/api/received_quantity", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        picking_id: record.id,
                        move_line_id: moveLineId,
                        received_quantity: value,
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.detail || "Erro ao atualizar quantidade.");
                }

                render();
                AppInventory.showToast("Quantidade atualizada.");
            });
        } catch (error) {
            console.error("Erro ao atualizar quantidade:", error);
            record.receivedQuantity = previousValue;
            input.value = previousValue;
            updateValidationButtonsState(card, record);
            AppInventory.showToast(error.message || "Erro ao atualizar quantidade.", "!");
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
                    (record) => options.isPending(record),
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

        const readyToPrintCounter =
            document.getElementById("readyToPrintCount") ||
            elements.readyToPrintCount;

        if (readyToPrintCounter) {
            const readyToPrintCount =
                options.getReadyToPrintCount(records);

            readyToPrintCounter.textContent = formatCount(
                readyToPrintCount,
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

        // Hook pós-render: permitir que etapas reajam após o render principal
        try {
            if (typeof options.onAfterRender === 'function') {
                try {
                    options.onAfterRender(visibleRecords);
                } catch (e) {
                    console.error('Erro em onAfterRender handler:', e);
                }
            }

            // Event público para listeners externos (ex.: pre_separacao)
            try {
                document.dispatchEvent(new CustomEvent('appinventory:afterRender', { detail: { records: visibleRecords } }));
            } catch (e) {
                // Não crítico se dispatch falhar em ambientes restritos
                console.warn('Não foi possível disparar appinventory:afterRender:', e);
            }
        } catch (e) {
            console.error('Erro ao executar hooks pós-render:', e);
        }
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
        const searchArea = searchInput?.closest(".search-area");

        if (!searchInput || !clearSearch || !searchArea) {
            console.error("Pesquisa: elementos HTML não encontrados.");
            return;
        }

        const currentStage = window.location.pathname
            .split("/")
            .filter(Boolean)
            .pop();

        const isReceivingStage = [
            "recebimento-fiscal",
            "recebimento-qualidade",
        ].includes(currentStage);

        const searchOptions = isReceivingStage
            ? [
                { label: "Nota fiscal", field: "nota_fiscal" },
                { label: "Fornecedor", field: "fornecedor" },
                { label: "Pedido de Compra", field: "pedido_compra" },
            ]
            : [
                { label: "Pedido de Venda", field: "pedido_venda" },
                { label: "Cliente", field: "cliente" },
            ];

        // Guarda os registros originais para permitir limpar a pesquisa.
        const originalRecords = records.map((record) => ({ ...record }));

        // Cria ou reutiliza o contêiner da pesquisa.
        let searchWrapper = searchArea.parentElement?.classList.contains(
            "search-options-wrapper"
        )
            ? searchArea.parentElement
            : null;

        if (!searchWrapper) {
            searchWrapper = document.createElement("div");
            searchWrapper.className = "search-options-wrapper";

            searchArea.parentNode.insertBefore(searchWrapper, searchArea);
            searchWrapper.appendChild(searchArea);
        }

        // Cria ou reutiliza o painel e sempre reconstrói seus botões.
        let optionsPanel = document.getElementById("searchOptionsPanel");

        if (!optionsPanel) {
            optionsPanel = document.createElement("div");
            optionsPanel.id = "searchOptionsPanel";
            optionsPanel.className = "search-options-panel";
            optionsPanel.setAttribute("aria-label", "Opções de pesquisa");
            searchWrapper.appendChild(optionsPanel);
        } else if (optionsPanel.parentElement !== searchWrapper) {
            searchWrapper.appendChild(optionsPanel);
        }

        const optionsTitle = document.createElement("p");
        optionsTitle.className = "search-options-title";
        optionsTitle.textContent = "Pesquisar por:";

        const optionsList = document.createElement("div");
        optionsList.className = "search-options-list";

        let selectedSearchField = null;

        const updateSelectedOption = () => {
            optionsList.querySelectorAll(".search-option").forEach((button) => {
                const selected = button.dataset.field === selectedSearchField;

                button.classList.toggle("selected", selected);
                button.setAttribute("aria-pressed", String(selected));
            });
        };

        const updateClearButton = () => {
            clearSearch.style.display = searchInput.value.trim()
                ? "block"
                : "none";
        };

        const updateSearchOptions = () => {
            optionsPanel.classList.toggle(
                "is-visible",
                Boolean(searchInput.value.trim())
            );

            updateClearButton();
        };

        const search = async () => {
            if (actionInProgress) {
                return;
            }

            const term = searchInput.value.trim();

            if (!term) {
                showToast("Digite um termo para pesquisar.", "!");
                searchInput.focus();
                return;
            }

            if (!selectedSearchField) {
                showToast("Selecione um campo para pesquisar.", "!");
                return;
            }

            const params = new URLSearchParams({
                campo: selectedSearchField,
                termo: term,
            });

            try {
                await runAction(async () => {
                    const url =
                        `/api/inventario/buscar/${encodeURIComponent(currentStage)}` +
                        `?${params.toString()}`;

                    const response = await fetch(url, {
                        headers: {
                            Accept: "application/json",
                        },
                        cache: "no-store",
                    });

                    const data = await response.json().catch(() => null);

                    if (!response.ok) {
                        throw new Error(
                            data?.detail ||
                            `Erro ao pesquisar registros (HTTP ${response.status}).`
                        );
                    }

                    if (!data || !Array.isArray(data.records)) {
                        throw new Error(
                            "A resposta da pesquisa não contém uma lista válida em 'records'."
                        );
                    }

                    replaceRecords(data.records);

                    // Mantém o campo selecionado e fecha a caixa de filtros.
                    updateSelectedOption();
                    optionsPanel.classList.remove("is-visible");

                    if (data.records.length === 0) {
                        showToast("Nenhum picking encontrado para essa pesquisa.", "!");
                    }
                });
            } catch (error) {
                console.error("Erro ao pesquisar registros:", error);

                showToast(
                    error.message || "Não foi possível buscar os registros.",
                    "!"
                );
            }
        };

        // Constrói os botões independentemente de o painel já existir no HTML.
        searchOptions.forEach(({ label, field }) => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "search-option";
            button.textContent = label;
            button.dataset.field = field;
            button.setAttribute("aria-pressed", "false");

            button.addEventListener("click", () => {
                selectedSearchField = field;
                updateSelectedOption();

                // Ao clicar no campo, pesquisa imediatamente se já há texto.
                if (searchInput.value.trim()) {
                    search();
                } else {
                    searchInput.focus();
                }
            });

            optionsList.appendChild(button);
        });

        optionsPanel.replaceChildren(optionsTitle, optionsList);

        searchInput.addEventListener("input", updateSearchOptions);

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
            selectedSearchField = null;

            updateSelectedOption();
            updateSearchOptions();

            // Restaura os registros carregados antes da pesquisa.
            replaceRecords(originalRecords.map((record) => ({ ...record })));

            options.search.onClear?.();
            searchInput.focus();
        });

        updateSearchOptions();
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
            await runAction(async () => {
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
            });

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
            await runAction(async () => {
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
            });
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
            await runAction(async () => {
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
            });
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

        await runAction(async () => {
            await options.refreshRecords({
                getRecords: () => records,
                replaceRecords,
                render,
                showToast,
            });
        });
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

        const handleDashboardCardClick = (event) => {
            const button =
                event.target.closest(".dashboard-card");

            if (!button || actionInProgress) {
                return;
            }

            filter = button.dataset.filter || filter;

            document
                .querySelectorAll(".dashboard-card")
                .forEach((card) => {
                    card.classList.toggle(
                        "active",
                        card === button,
                    );
                });

            render();
        };

        document.addEventListener(
            "click",
            handleDashboardCardClick,
        );

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
        updateReceivedQuantity,
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
