(function () {
    "use strict";

    /* =========================================================
       ÍCONES (SVG em linha, traço contínuo)
       Substituem emojis: aparência igual em todos os aparelhos.
    ========================================================= */

    const ICON_PATHS = {
        check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        alert: '<path d="M12 4 2.8 19.5h18.4L12 4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
        chat: '<path d="M4 5.5h16v10.5H9l-5 4V5.5z"/>',
        camera: '<path d="M4 8.5h3.2L9 6h6l1.8 2.5H20v10.5H4z"/><circle cx="12" cy="13.2" r="3.3"/>',
        print: '<path d="M7 9V3.8h10V9"/><rect x="4" y="9" width="16" height="7.5" rx="2"/><path d="M7 14h10v6.2H7z"/>',
        package: '<path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2z"/><path d="M4 7.2l8 4.2 8-4.2M12 11.4V21"/>',
        screw: '<rect x="4" y="3.5" width="16" height="4" rx="1.2"/><path d="M12 7.5V21"/><path d="M8 11l8 2M8 15l8 2M8 19l8 2"/>',
        scale: '<path d="M12 4v16M7 20h10M5 7.5h14"/><path d="M5 7.5L2.5 13h5zM19 7.5L16.5 13h5z"/>',
        layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
        tool: '<path d="M14.7 6.3a4 4 0 0 0 5 5l-8.2 8.2a2.1 2.1 0 0 1-3-3l8.2-8.2z"/>',
        eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
        scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 9v6M12 9v6M16 9v6"/>',
        user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c1-3.7 3.8-5.6 7.2-5.6s6.2 1.9 7.2 5.6"/>',
        search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
        back: '<path d="M14.5 6L8.5 12l6 6"/>',
        send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
        circleCheck: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16 9.5"/>',
    };

    function iconSvg(name, className = "") {
        const paths = ICON_PATHS[name] || "";
        return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    }

    /* Cria um <span> com o ícone. Se `raw` for informado, usa esse HTML no lugar do ícone. */
    function iconSpan(name, className, raw) {
        const element = document.createElement("span");
        element.className = className || "";
        element.innerHTML = raw ?? iconSvg(name);
        return element;
    }

    window.AppIcons = Object.freeze({
        svg: iconSvg,
        span: iconSpan,
    });

    /* Tarjas de status sobre o card (ícone e texto lado a lado). */
    const TARJA_VARIANTS = {
        correction: { text: "CORREÇÃO DE PESO SOLICITADA", icon: "tool" },
        estoque: { text: "ESTOQUE PENDENTE", icon: "package" },
    };

    function setTarja(card, variant) {
        card.querySelector(":scope > .picking-tarja")?.remove();

        const config = TARJA_VARIANTS[variant];
        if (!config) {
            return;
        }

        const band = document.createElement("div");
        band.className = `picking-tarja picking-tarja--${variant}`;
        band.setAttribute("role", "status");
        band.innerHTML = `${iconSvg(config.icon)}<span>${config.text}</span>`;
        card.appendChild(band);
    }

    // Card com tarja ativa não abre detalhes nem recebe ações.
    function isTarjaLocked(card) {
        return Boolean(
            card &&
            (card.classList.contains("correction-requested") ||
                card.classList.contains("stock-pending")),
        );
    }

    window.AppTarja = Object.freeze({
        set: setTarja,
        isLocked: isTarjaLocked,
    });


    const elements = {
        records: document.getElementById("inventoryStageRecords"),
        container: document.getElementById("pickingsContainer"),
        emptyState: document.getElementById("emptyState"),
        section: document.getElementById("currentSection"),
        resultCount: document.getElementById("resultCount"),
        pendingCount: document.getElementById("pendingCount"),
        progressCount: document.getElementById("progressCount"),
        conferidosCount: document.getElementById("conferidosCount"),
        readyToPrintCount: document.getElementById("readyToPrintCount"),
        validationText: document.getElementById("validationText"),
        validationButton: document.getElementById("confirmValidation"),
        chatPanel: document.getElementById("chatPanel"),
        chatInfo: document.getElementById("chatPickingInfo"),
        chatHeaderLabel: document.getElementById("chatHeaderLabel"),
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

            if (filter === "conferidos") {
                return "REGISTROS CONFERIDOS";
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
        isConferido: () => false,
        isPending: (record) => !record.validated,
        matchesRecord: () => true,
        isReadyToPrint: () => false,
        getDashboardCount: (records, matches) => records.filter(matches).length,
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
    let qualityPhotos = [];
    const MAX_QUALITY_PHOTOS = 3;

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

        if (filter === "conferidos") {
            return Boolean(options.isConferido(record));
        }

        if (filter === "pronto-para-imprimir") {
            return options.isReadyToPrint(record);
        }

        return !record.validated && (
            options.isPending(record) ||
            options.isInProgress(record)
        );
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
            button.append(AppIcons.span(null, "action-icon-small", icon));
        }

        button.append(
            document.createTextNode(label),
        );

        button.addEventListener("click", onClick);

        if (className && className.includes("print-action")) {
            startPrintButtonAttention(button);
        }

        return button;
    }

    function triggerPrintButtonShake(button) {
        if (!button || button.disabled || button.dataset.printButtonPrinted === "true") {
            return;
        }

        button.classList.remove("print-action-shaking");
        void button.offsetWidth;
        button.classList.add("print-action-shaking");

        window.setTimeout(() => {
            button.classList.remove("print-action-shaking");
        }, 700);
    }

    function startPrintButtonAttention(button) {
        if (!button || !button.classList.contains("print-action") || button.dataset.printButtonPrinted === "true") {
            return;
        }

        if (button.dataset.printButtonShakeTimer) {
            return;
        }

        button.dataset.printButtonShakeTimer = String(
            window.setInterval(() => {
                triggerPrintButtonShake(button);
            }, 15000),
        );
    }

    function stopPrintButtonAttention(button) {
        if (!button || !button.dataset.printButtonShakeTimer) {
            return;
        }

        window.clearInterval(Number(button.dataset.printButtonShakeTimer));
        delete button.dataset.printButtonShakeTimer;
        button.classList.remove("print-action-shaking");
    }

    function markPrintButtonPrinted(button) {
        if (!button || !button.classList.contains("print-action")) {
            return;
        }

        button.dataset.printButtonPrinted = "true";
        stopPrintButtonAttention(button);
        button.classList.remove("print-action-shaking");
    }

    function normalizeBooleanValue(value) {
        if (typeof value === "string") {
            return ["1", "true", "yes", "y", "t"].includes(value.trim().toLowerCase());
        }

        if (typeof value === "number") {
            return value !== 0;
        }

        return Boolean(value);
    }

    function updateValidationButtonsState(card, record) {
        const shouldDisable = Number(record.receivedQuantity) <= 0;
        const hasWeightDivergence = normalizeBooleanValue(record.divergencia_peso_picking);

        card?.querySelectorAll(".validation-action").forEach((button) => {
            const baseDisabled = button.dataset.baseDisabled === "true";
            button.disabled = baseDisabled || shouldDisable || hasWeightDivergence;
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
            icon: AppIcons.svg("check"),
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
            icon: AppIcons.svg("alert"),
            disabled,
            onClick: () => openQuality(record),
        });
    }

    function getQuantityUnit(record) {
        const unit = record.uom || record.product_uom || record.product_uom_id || record.productUom || "UN";

        if (Array.isArray(unit) && unit.length > 1) {
            return String(unit[1] || "UN");
        }

        if (unit && typeof unit === "object") {
            return String(unit.name || unit[1] || "UN");
        }

        return String(unit || "UN");
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
            icon: AppIcons.svg("chat"),
            label: "",
            ariaLabel: "Abrir chat do registro",
            title: "Abrir chat",
            onClick: () => openChat(record),
        });

        // Texto ao lado do ícone; o mesmo rótulo vale para chatter e follow-up.
        chatTab.append(createElement("span", "chat-tab-label", "Follow-Up"));

        // Grupo de abas no topo do card. Etapas podem acrescentar abas à
        // esquerda do follow-up via context.tabs (ex.: recebimento de qualidade).
        const tabs = createElement("div", "card-tabs");
        tabs.append(chatTab);

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
        const product = createElement("div", "product-info");  //Variável que indica o código do produto
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
        expectedQuantity.textContent = `Esperado: ${record.expectedQuantity} ${getQuantityUnit(record)}`;

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

            tabs,

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
            tabs,
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
                options.getDashboardCount(
                    records,
                    (record) => !record.validated && (
                        options.isPending(record) ||
                        options.isInProgress(record)
                    ),
                ),
            );
        }

        if (elements.progressCount) {
            elements.progressCount.textContent = formatCount(
                options.getDashboardCount(
                    records,
                    (record) =>
                        !record.validated &&
                        options.isInProgress(record),
                ),
            );
        }

        if (elements.conferidosCount) {
            elements.conferidosCount.textContent = formatCount(
                options.getDashboardCount(
                    records,
                    (record) => Boolean(options.isConferido(record)),
                ),
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

    /* Converte o ícone recebido (símbolo legado ou nome) em SVG para o toast. */
    const TOAST_ICON_NAMES = {
        "✓": "check",
        "✔": "check",
        "✗": "close",
        "✕": "close",
        "!": "alert",
        "⚠": "alert",
        "⚠️": "alert",
    };

    function showToast(message, icon = "✓") {
        window.AppUI.showToast(message, "");

        const toastIcon = document.getElementById("toastIcon");
        if (toastIcon) {
            toastIcon.innerHTML = iconSvg(TOAST_ICON_NAMES[icon] || "check");
        }
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

                const remainingRecords = records.filter(
                    (current) => Number(current.id) !== Number(record.id),
                );

                if (remainingRecords.length !== records.length) {
                    replaceRecords(remainingRecords, { renderRecords: false });
                }

                window.AppUI.closeModal(
                    "validationModal",
                );

                if (typeof options.refreshRecords === "function") {
                    await options.refreshRecords({
                        getRecords: () => records,
                        replaceRecords,
                        render,
                        showToast,
                    });
                } else {
                    render();
                }

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
        resetQualityPhotos();

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

        const photos = await Promise.all(
            qualityPhotos.map(async (photo) => {
                if (!photo?.file) {
                    return "";
                }

                return readFileAsDataUrl(photo.file);
            }),
        );

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
            photos: photos.filter(Boolean).slice(0, MAX_QUALITY_PHOTOS),
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

    function renderQualityPhotoCounter() {
        const counter = document.getElementById("qualityPhotosCounter");

        if (counter) {
            counter.textContent = `(${qualityPhotos.length} de ${MAX_QUALITY_PHOTOS})`;
        }
    }

    function resetQualityPhotos() {
        qualityPhotos.forEach((photo) => {
            if (photo.url) {
                URL.revokeObjectURL(photo.url);
            }
        });

        qualityPhotos = [];
        renderQualityPhotoList();
    }

    function renderQualityPhotoList() {
        const list = document.getElementById("qualityPhotoList");

        if (!list) {
            renderQualityPhotoCounter();
            return;
        }

        list.replaceChildren(
            ...qualityPhotos.map((photo) => {
                const item = createElement("div", "quality-photo-item");
                const image = document.createElement("img");
                const removeButton = createElement("button", "quality-photo-remove");

                image.className = "quality-photo-preview";
                image.src = photo.url;
                image.alt = "Foto adicionada ao alerta de qualidade";
                image.loading = "lazy";

                removeButton.type = "button";
                removeButton.setAttribute("aria-label", "Remover foto");
                removeButton.title = "Remover foto";
                removeButton.textContent = "×";
                removeButton.addEventListener("click", () => {
                    if (photo.url) {
                        URL.revokeObjectURL(photo.url);
                    }

                    qualityPhotos = qualityPhotos.filter(
                        (current) => current.id !== photo.id,
                    );

                    renderQualityPhotoList();
                });

                item.append(image, removeButton);
                return item;
            }),
        );

        renderQualityPhotoCounter();
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
            reader.readAsDataURL(file);
        });
    }

    function selectQualityPhoto(input) {
        const files = Array.from(input.files || []);

        if (!files.length) {
            return;
        }

        files.forEach((file) => {
            if (!file || !file.type.startsWith("image/")) {
                return;
            }

            if (qualityPhotos.length >= MAX_QUALITY_PHOTOS) {
                showToast(
                    "Você pode adicionar até 3 fotos.",
                    "!",
                );
                return;
            }

            qualityPhotos.push({
                id: `${Date.now()}-${Math.random()}`,
                file,
                url: URL.createObjectURL(file),
            });
        });

        input.value = "";
        renderQualityPhotoList();
    }

    function initializeQualityPhotos() {
        const cameraInput = document.getElementById("qualityCameraInput");

        document.querySelectorAll("[data-quality-photo-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const action = button.dataset.qualityPhotoAction;

                if (action === "camera") {
                    cameraInput?.click();
                }
            });
        });

        cameraInput?.addEventListener("change", (event) => {
            selectQualityPhoto(event.target);
        });

        renderQualityPhotoList();
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
                    AppIcons.span("check", "cause-check"),
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

    // Picking com pedido de venda: o chat vira o follow-up do pedido.
    function isFollowupRecord(record) {
        return Boolean(record?.pedido_venda_id);
    }

    function setChatMode(record) {
        const followup = isFollowupRecord(record);

        if (elements.chatHeaderLabel) {
            elements.chatHeaderLabel.textContent = followup
                ? "FOLLOW-UP DO PEDIDO"
                : "CHAT DA ETAPA";
        }

        if (elements.chatInput) {
            elements.chatInput.placeholder = followup
                ? "Escreva o follow-up para o pedido..."
                : "Digite uma mensagem...";
        }

        if (elements.chatInfo) {
            elements.chatInfo.textContent = followup
                ? `${record.pedido_venda_name || ""} • ${record.product || ""}`
                : `${record.pv || record.reference || ""} • ${record.product || ""}`;
        }
    }

    // Converte o HTML do histórico do Odoo em texto puro, igual ao chatter.
    function followupHtmlToText(element) {
        const template = document.createElement("template");
        template.innerHTML = element.innerHTML
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<\/(p|div)>/gi, " ");

        return template.content.textContent.replace(/\s+/g, " ").trim();
    }

    // Cada bloco do histórico do Odoo é um <div> com cabeçalho (autor) e corpo.
    // Blocos sem essa estrutura (ex.: "Nenhum follow-up...") viram aviso vazio.
    function parseFollowupHistory(html) {
        const template = document.createElement("template");
        template.innerHTML = html || "";

        return [...template.content.children].map((block) => {
            const [header, body] = block.children;

            if (block.tagName === "DIV" && header && body) {
                return {
                    empty: false,
                    author: header.querySelector("strong")?.textContent.trim() || "Sistema",
                    text: followupHtmlToText(body),
                };
            }

            return { empty: true, text: followupHtmlToText(block) };
        });
    }

    function renderFollowupHistory(html) {
        if (!elements.chatMessages) {
            return;
        }

        const nodes = parseFollowupHistory(html).map((entry) => {
            if (entry.empty) {
                return createElement("div", "chat-empty", entry.text);
            }

            const item = createElement("div", "chat-message received");

            item.append(
                createElement("span", "chat-message-author", entry.author),
                createElement("span", "chat-message-text", entry.text),
            );

            return item;
        });

        if (nodes.length === 0) {
            nodes.push(
                createElement("div", "chat-empty", "Nenhuma mensagem ainda. Inicie uma conversa sobre este registro."),
            );
        }

        elements.chatMessages.replaceChildren(...nodes);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    async function loadFollowupChat(record) {
        try {
            await runAction(async () => {
                const response = await fetch(
                    `/api/inventario/pickings/${record.id}/followup`,
                    {
                        method: "GET",
                        headers: { Accept: "application/json" },
                        cache: "no-store",
                    },
                );

                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    throw new Error(
                        data?.detail ||
                        "Não foi possível carregar o follow-up.",
                    );
                }

                if (selectedChatRecord?.id === record.id) {
                    renderFollowupHistory(data?.historico_html);
                }
            });
        } catch (error) {
            console.error("Erro ao carregar follow-up:", error);

            if (elements.chatMessages) {
                elements.chatMessages.replaceChildren(
                    createElement("div", "chat-empty", error.message || "Não foi possível carregar o follow-up."),
                );
            }
        }
    }

    async function sendFollowupMessage(text) {
        const pickingId = selectedChatRecord.id;

        elements.chatInput.disabled = true;

        try {
            await runAction(async () => {
                const response = await fetch(
                    `/api/inventario/pickings/${pickingId}/followup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Accept: "application/json",
                        },
                        body: JSON.stringify({ mensagem: text }),
                    },
                );

                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    throw new Error(
                        data?.detail ||
                        "Não foi possível registrar o follow-up.",
                    );
                }

                elements.chatInput.value = "";

                if (selectedChatRecord?.id === pickingId) {
                    renderFollowupHistory(data?.historico_html);
                }
            });
        } catch (error) {
            console.error("Erro ao enviar follow-up:", error);

            showToast(
                error.message ||
                "Não foi possível registrar o follow-up.",
                "!",
            );
        } finally {
            elements.chatInput.disabled = false;
            elements.chatInput.focus();
        }
    }

    async function openChat(record) {
        if (!record || !elements.chatPanel) {
            return;
        }

        selectedChatRecord = record;

        setChatMode(record);

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

        if (isFollowupRecord(record)) {
            await loadFollowupChat(record);

            setTimeout(() => {
                elements.chatInput?.focus();
            }, 100);

            return;
        }

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

        if (isFollowupRecord(selectedChatRecord)) {
            await sendFollowupMessage(text);
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

        initializeQualityPhotos();
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

    // Etiquetas impressas na sessão atual do navegador. O sessionStorage
    // mantém a informação ao recarregar a página e é descartado ao fechar
    // a aba ou ao abrir a tela de login (ver login.js).
    const PRINTED_LABELS_STORAGE_KEY = "app_logistica:etiquetasImpressas";

    function readPrintedLabels() {
        try {
            const stored = JSON.parse(
                window.sessionStorage.getItem(PRINTED_LABELS_STORAGE_KEY),
            );
            return new Set(Array.isArray(stored) ? stored.map(Number) : []);
        } catch (error) {
            return new Set();
        }
    }

    function hasPrintedLabel(pickingId) {
        return readPrintedLabels().has(Number(pickingId));
    }

    function markLabelPrinted(pickingId) {
        const printedLabels = readPrintedLabels();
        printedLabels.add(Number(pickingId));

        try {
            window.sessionStorage.setItem(
                PRINTED_LABELS_STORAGE_KEY,
                JSON.stringify([...printedLabels]),
            );
        } catch (error) {
            console.warn("Não foi possível salvar a etiqueta impressa na sessão:", error);
        }
    }

    window.AppInventory = Object.freeze({
        configure,
        getRecord,
        getRecords: () => records,
        hasPrintedLabel,
        hideLoading,
        initialize,
        isActionInProgress: () => actionInProgress,
        markLabelPrinted,
        markPrintButtonPrinted,
        openChat,
        openQuality,
        openValidation,
        registerPrintButtonAttention: startPrintButtonAttention,
        render,
        replaceRecords,
        runAction,
        showLoading,
        showToast,
        stopPrintButtonAttention,
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