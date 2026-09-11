/* =========================================================
   RECEBIMENTO QUALIDADE - V6
========================================================= */


let pickings = [];


/* =========================================================
   ESTADO DA INTERFACE
========================================================= */

let currentFilter = "pendentes";

let searchTerm = "";

let filteredPickingIds = null;

let currentPickingId = null;

let currentPhotoIndex = null;

let photoSession = [];

let photosSaving = false;

let qualityCauses = [];

let selectedQualityCauses = [];

let actionInProgress = false;

let barcodeScannerReader = null;

let barcodeScannerControls = null;

let barcodeScannerActive = false;

let barcodeScannerPickingId = null;

let chatMessages = {};

let currentChatPickingId = null;

const photoInstructions = [
    "Tirar foto da EMBALAGEM",
    "Tirar foto do PRODUTO",
    "Tirar foto da AMOSTRAGEM"
];



/*=========================================================
   ELEMENTOS
========================================================= */

const pullToRefresh =
    document.getElementById("pullToRefresh");

const pullRefreshIcon =
    document.getElementById("pullRefreshIcon");

const pullRefreshText =
    document.getElementById("pullRefreshText");

const stageKey =
    document.body.dataset.stageKey;

const pickingsContainer =
    document.getElementById("pickingsContainer");

const emptyState =
    document.getElementById("emptyState");

const currentSection =
    document.getElementById("currentSection");

const resultCount =
    document.getElementById("resultCount");

const searchInput =
    document.getElementById("searchInput");

const clearSearch =
    document.getElementById("clearSearch");

const photoCameraInput =
    document.getElementById("photoCameraInput");

const qualityRecordsElement =
    document.getElementById("qualityRecords");

const barcodeScannerVideo =
    document.getElementById("barcodeScannerVideo");

const barcodeScannerStatus =
    document.getElementById("barcodeScannerStatus");

const chatPanel =
    document.getElementById("chatPanel");

const chatPickingInfo =
    document.getElementById("chatPickingInfo");

const chatMessagesContainer =
    document.getElementById("chatMessages");

const chatForm =
    document.getElementById("chatForm");

const chatInput =
    document.getElementById("chatInput");

const chatSendButton =
    document.getElementById("chatSendButton");



/* =========================================================
   PULL TO REFRESH
========================================================= */

let pullStartY = 0;

let pullCurrentY = 0;

let pullDistance = 0;

let pullTracking = false;

let pullRefreshing = false;

let pullReady = false;

const PULL_THRESHOLD = 70;

const PULL_MAX_DISTANCE = 150;


/* =========================================================
   CONFIGURAÇÃO
========================================================= */

function setupPullToRefresh() {

    if (!pullToRefresh) {
        return;
    }

    document.addEventListener(
        "touchstart",
        handlePullTouchStart,
        {
            passive: true
        }
    );


    document.addEventListener(
        "touchmove",
        handlePullTouchMove,
        {
            passive: false
        }
    );


    document.addEventListener(
        "touchend",
        handlePullTouchEnd,
        {
            passive: true
        }
    );


    document.addEventListener(
        "touchcancel",
        resetPullToRefresh,
        {
            passive: true
        }
    );

}


/* =========================================================
   TOUCH START
========================================================= */

function handlePullTouchStart(event) {

    if (pullRefreshing) {
        return;
    }

    if (actionInProgress) {
        return;
    }


    /*
     * Só funciona quando a página realmente
     * está no topo.
     */
    if (window.scrollY > 0) {
        return;
    }


    /*
     * Não iniciar Pull to Refresh dentro de modal.
     */
    if (
        event.target.closest(".modal-overlay")
    ) {
        return;
    }


    /*
     * Não iniciar o gesto quando o usuário
     * está interagindo com elementos de formulário.
     */
    if (event.target.closest("input, textarea, select")){
        return;
    }


    pullStartY =
        event.touches[0].clientY;

    pullCurrentY =
        pullStartY;

    pullDistance = 0;

    pullTracking = true;

    pullReady = false;

}


/* =========================================================
   TOUCH MOVE
========================================================= */

function handlePullTouchMove(event) {

    if (!pullTracking) {
        return;
    }

    if (pullRefreshing) {
        return;
    }


    /*
     * Se o usuário saiu do topo durante o gesto,
     * cancelamos.
     */
    if (document.documentElement.scrollTop > 1) {
        return;
    }   


    pullCurrentY =
        event.touches[0].clientY;


    const rawDistance =
        pullCurrentY - pullStartY;


    /*
     * Movimento para cima não é Pull to Refresh.
     */
    if (rawDistance <= 0) {

        resetPullToRefresh();

        return;

    }


    /*
     * Resistência do movimento.
     *
     * Quanto mais o usuário puxa,
     * menor fica o deslocamento visual.
     */
    pullDistance =
        Math.min(
            rawDistance * 0.55,
            PULL_MAX_DISTANCE
        );


    /*
     * Agora que temos um movimento vertical
     * válido, impedimos o comportamento normal
     * do navegador.
     */
    event.preventDefault();


    const translateY =
        pullDistance;


    pullToRefresh.style.transform =
        `translateY(${pullDistance - 64}px)`;


    pullToRefresh.classList.add(
        "visible"
    );


    /*
     * Verifica se atingiu o limite.
     */
    if (
        pullDistance >= PULL_THRESHOLD
    ) {

        if (!pullReady) {

            pullReady = true;

            pullToRefresh.classList.add(
                "ready"
            );

            pullRefreshIcon.textContent =
                "↑";

            pullRefreshText.textContent =
                "Solte para atualizar";

        }

    } else {

        if (pullReady) {

            pullReady = false;

            pullToRefresh.classList.remove(
                "ready"
            );

            pullRefreshIcon.textContent =
                "↓";

            pullRefreshText.textContent =
                "Puxe para atualizar";

        }

    }

}


/* =========================================================
   TOUCH END
========================================================= */

async function handlePullTouchEnd() {

    if (!pullTracking) {
        return;
    }


    pullTracking = false;


    /*
     * Se não chegou ao limite,
     * simplesmente esconde o indicador.
     */
    if (!pullReady) {

        resetPullToRefresh();

        return;

    }


    await executePullToRefresh();

}


/* =========================================================
   EXECUTA REFRESH
========================================================= */

async function executePullToRefresh() {

    if (pullRefreshing) {
        return;
    }


    pullRefreshing = true;

    actionInProgress = true;


    pullToRefresh.classList.add(
        "visible",
        "refreshing"
    );


    pullToRefresh.classList.remove(
        "ready"
    );


    pullRefreshIcon.textContent =
        "↻";


    pullRefreshText.textContent =
        "Atualizando...";


    /*
     * Mantém o indicador visível.
     */
    pullToRefresh.style.transform =
        "translateY(0)";


    try {

        const response =
            await fetch(
                `/api/recebimento-qualidade/pickings/refresh/${encodeURIComponent(stageKey)}`,
                {
                    method: "GET",

                    headers: {
                        "Accept": "application/json"
                    },

                    cache: "no-store"
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            data = null;

        }


        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Não foi possível atualizar os recebimentos."
            );

        }


        /*
         * O InventoryService já retorna:
         *
         * {
         *     "records": [...]
         * }
         */
        const records =
            data?.records;


        if (!Array.isArray(records)) {

            throw new TypeError(
                "O servidor retornou registros em formato inválido."
            );

        }


        /*
         * Atualiza o estado local exatamente
         * como loadPickings() faz.
         */
        pickings = records.map(picking => ({
            ...picking,
            photos: [],
            photosRegistered: Boolean(picking.photosRegistered),
            photoCount: Number(picking.photoCount || 0),
            barcodeRegistered: Boolean(picking.barcodeRegistered),
            qualityAlert: null
        }));


        /*
         * Mantém o filtro atual e renderiza novamente.
         */
        render();


        showToast(
            "RECEBIMENTOS ATUALIZADOS",
            "✓"
        );


    } catch (error) {

        console.error(
            "Erro no Pull to Refresh:",
            error
        );


        showToast(
            error.message ||
            "Não foi possível atualizar os recebimentos.",
            "!"
        );


    } finally {

        /*
         * Dá um pequeno tempo para o usuário
         * perceber que terminou.
         */
        setTimeout(
            () => {

                pullToRefresh.classList.remove(
                    "refreshing",
                    "visible",
                    "ready"
                );


                pullRefreshIcon.textContent =
                    "↓";


                pullRefreshText.textContent =
                    "Puxe para atualizar";


                pullToRefresh.style.removeProperty("transform");


                pullRefreshing = false;

                actionInProgress = false;

            },
            300
        );

    }

}


/* =========================================================
   RESET
========================================================= */

function resetPullToRefresh() {

    pullTracking = false;

    pullReady = false;

    pullDistance = 0;


    if (!pullToRefresh) {
        return;
    }


    pullToRefresh.classList.remove(
        "visible",
        "ready",
        "refreshing"
    );


    pullRefreshIcon.textContent =
        "↓";


    pullRefreshText.textContent =
        "Puxe para atualizar";


    pullToRefresh.style.removeProperty("transform");

}



/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupDashboard();

    setupSearch();

    setupPhotoSlots();

    setupPhotoInput();

    setupQualityForm();

    setupQuantityValidation();

    setupQualityCauses();

    setupBarcodeScanner();

    setupPullToRefresh();
    
    setupChat();

    loadPickings();

});



async function loadPickings() {

    try {

        const records =
            JSON.parse(
                qualityRecordsElement.textContent
            );

        if (!Array.isArray(records)) {

            throw new TypeError(
                "Os registros de recebimento têm formato inválido."
            );

        }

        pickings = records.map(picking => ({
            ...picking,
            photos: [],
            photosRegistered: Boolean(picking.photosRegistered),
            photoCount: Number(picking.photoCount || 0),
            barcodeRegistered: Boolean(picking.barcodeRegistered),
            qualityAlert: null
        }));

    } catch (error) {

        console.error(error);

        showToast(
            "Não foi possível carregar os recebimentos do Odoo.",
            "!"
        );

    }

    render();

}


/* =========================================================
   LOADING GLOBAL
========================================================= */

function showLoading() {

    actionInProgress = true;
    window.AppUI.showLoading();

}


function hideLoading() {

    actionInProgress = false;
    window.AppUI.hideLoading();

}


/* =========================================================
   DASHBOARD
========================================================= */

function setupDashboard() {

    const cards =
        document.querySelectorAll(
            ".dashboard-card"
        );

    cards.forEach(card => {

        card.addEventListener(
            "click",
            () => {

                if (actionInProgress) {
                    return;
                }

                currentFilter =
                    card.dataset.filter;

                cards.forEach(item => {

                    item.classList.remove(
                        "active"
                    );

                });

                card.classList.add(
                    "active"
                );

                render();

            }
        );

    });

}


/* =========================================================
   PESQUISA
========================================================= */

function setupSearch() {

    searchInput.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Enter") {
                return;
            }

            searchTerm =
                searchInput.value
                    .trim();

            if (!searchTerm) {

                filteredPickingIds = null;

                clearSearch.style.display =
                    "none";

                render();

                return;

            }

            filterByNF(searchTerm);

        }
    );


    clearSearch.addEventListener(
        "click",
        () => {

            if (actionInProgress) {
                return;
            }

            searchInput.value = "";

            searchTerm = "";

            filteredPickingIds = null;

            clearSearch.style.display =
                "none";

            render();

            searchInput.focus();

        }
    );

}


async function filterByNF(nfNumber) {

    if (actionInProgress) {
        return;
    }

    showLoading();

    try {

        clearSearch.style.display =
            "block";

        const response =
            await fetch(
                `/api/recebimento-qualidade/pickings?nf_number=${encodeURIComponent(nfNumber)}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Não foi possível consultar a nota fiscal."
            );

        }


        filteredPickingIds =
            data.map(
                picking => picking.id
            );


        render();


    } catch (error) {

        console.error(
            "Erro ao filtrar por NF:",
            error
        );


        filteredPickingIds = [];

        render();


        showToast(
            error.message ||
            "Não foi possível consultar a nota fiscal.",
            "!"
        );

    }

    finally {

        hideLoading();

    }

}


/* =========================================================
   STATUS
========================================================= */

function getPickingStatus(picking) {

    if (picking.validated) {

        return {
            label: "CONCLUÍDO",
            className: "status-completed"
        };

    }


    if (
        picking.photos.length >= 3
        &&
        picking.photos.every(
            photo => photo !== null
        )
    ) {

        return {
            label: "PRONTO PARA VALIDAR",
            className: "status-ready"
        };

    }


    if (
        picking.photos.length > 0
        ||
        picking.photosRegistered
    ) {

        return {
            label: "FOTOS CONCLUÍDAS",
            className: "status-photos"
        };

    }


    return {
        label: "AGUARDANDO FOTOS",
        className: "status-waiting"
    };

}


/* =========================================================
   REGRAS DOS FILTROS
========================================================= */

function belongsToFilter(picking) {

    switch (currentFilter) {

        case "todos":

            return true;


        case "pendentes":

            return !picking.validated;


        case "andamento":
            return (
                !picking.validated
                &&
                picking.photosRegistered
            );



        case "concluidos":

            return picking.validated;


        default:

            return true;

    }

}


/* =========================================================
   RENDER
========================================================= */

function render() {

    updateDashboard();

    renderSectionTitle();

    const filteredPickings =
        pickings.filter(picking => {

            const matchesFilter =
                belongsToFilter(picking);

            const matchesSearch =
                filteredPickingIds === null
                ||
                filteredPickingIds.includes(picking.id);

            return (
                matchesFilter
                &&
                matchesSearch
            );

        });


    pickingsContainer.innerHTML = "";


    filteredPickings.forEach(picking => {

        pickingsContainer.appendChild(
            createPickingCard(picking)
        );

    });


    resultCount.textContent =
        `${filteredPickings.length} ${
            filteredPickings.length === 1
                ? "pedido"
                : "pedidos"
        }`;


    if (
        filteredPickings.length === 0
    ) {

        emptyState.classList.remove(
            "hidden"
        );

    } else {

        emptyState.classList.add(
            "hidden"
        );

    }

}


function formatCount(number) {

    if (number < 1000) {

        return number.toString();

    }


    if (number < 1000000) {

        const value =
            number / 1000;

        return `${parseFloat(
            value.toFixed(2)
        )}K`;

    }


    if (number < 1000000000) {

        const value =
            number / 1000000;

        return `${parseFloat(
            value.toFixed(2)
        )}M`;

    }


    const value =
        number / 1000000000;

    return `${parseFloat(
        value.toFixed(2)
    )}B`;

}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard() {

    const total =
        pickings.length; 


    const pending =
        pickings.filter(
            picking => !picking.validated
        ).length;


    const progress =
        pickings.filter(
            picking =>
                !picking.validated
                &&
                picking.photosRegistered
        ).length;



    const completed =
        pickings.filter(
            picking => picking.validated
        ).length; 


/*    document.getElementById(
        "totalCount"
    ).textContent =
        formatCount(total); */


    document.getElementById(
        "pendingCount"
    ).textContent =
        formatCount(pending);


    document.getElementById(
        "progressCount"
    ).textContent =
        formatCount(progress);


/*    document.getElementById(
        "completedCount"
    ).textContent =
        formatCount(completed); */

}


/* =========================================================
   TÍTULO DA SEÇÃO
========================================================= */

function renderSectionTitle() {

    const titles = {

        todos: "TODOS OS PEDIDOS",

        pendentes: "PEDIDOS PENDENTES",

        andamento: "PEDIDOS EM ANDAMENTO",

        concluidos: "PEDIDOS CONCLUÍDOS"

    };


    currentSection.textContent =
        titles[currentFilter];

}


/* =========================================================
   CARD DO PEDIDO
========================================================= */

function createPickingCard(picking) {

    const article =
        document.createElement("article");


    article.className =
        "picking-card";


    if (picking.validated) {

        article.classList.add(
            "completed-card"
        );

    }


    const status =
        getPickingStatus(picking);


    const validationAvailable =
        picking.photosRegistered === true &&
        picking.barcodeRegistered === true;



    article.innerHTML = `

        <button
            type="button"
            class="chat-tab ${
                chatMessages[picking.id]?.length > 0
                    ? "has-messages"
                    : ""
            }"
            data-action="chat"
            data-picking-id="${picking.id}"
            aria-label="Abrir chat do pedido ${picking.pv}"
            title="Abrir chat"
        >
            💬
        </button>

        <div class="picking-main">

            <div class="picking-identification">

                <strong>
                    ${picking.pv}
                </strong>

                <div class="picking-status ${status.className}">
                    ${status.label}
                </div>

            </div>


            <div class="client-info">

                <strong>
                    ${picking.client}
                </strong>

                <span>
                    Fornecedor
                </span>

            </div>


            <div class="quantity-box">

                <label>
                    QUANTIDADE RECEBIDA
                </label>

                <input
                    class="quantity-input"
                    type="number"
                    min="0"
                    value="${picking.receivedQuantity}"
                    data-picking-id="${picking.id}"
                >

                <span class="expected-quantity">
                    Esperado: ${picking.expectedQuantity} unidades
                </span>

            </div>


            <div>

                <strong>
                    Produto:<br/><br/>
                </strong>

                <h3>
                    ${picking.product}
                </h3>

            </div>

        </div>


        <div class="picking-actions">

            <button
                class="main-action photo-action
                    ${picking.photosRegistered ? "disabled" : ""}"
                data-action="photos"
                data-picking-id="${picking.id}"
                ${picking.photosRegistered ? "disabled" : ""}
            >

                <span class="action-icon-small">
                    📷
                </span>

                ${picking.photosRegistered
                    ? "FOTOS REGISTRADAS"
                    : "FOTOS"}

            </button>


            <button
                class="secondary-action quality-action
                    ${picking.photosRegistered ? "" : "disabled"}"
                data-action="quality"
                data-picking-id="${picking.id}"
                ${picking.photosRegistered ? "" : "disabled"}
            >
                ⚠️ ALERTA DE QUALIDADE
            </button>


            <button
                class="secondary-action print-action"
                data-action="print"
                data-picking-id="${picking.id}"
            >

                🖨️ IMPRIMIR ETIQUETA

            </button>


            <button
                class="main-action barcode-scanner-action
                    ${picking.photosRegistered ? "" : "disabled"}"
                data-action="barcode"
                data-picking-id="${picking.id}"
                aria-label="Ler código de barras"
                ${picking.photosRegistered ? "" : "disabled"}
            >
                <span class="action-icon-small">
                    ▥
                </span>
                LER CÓDIGO
            </button>


            <button
                class="main-action validation-action
                    ${validationAvailable ? "" : "disabled"}"
                data-action="validate"
                data-picking-id="${picking.id}"
                ${validationAvailable ? "" : "disabled"}
            >

                <span class="action-icon-small">
                    ✓
                </span>

                VALIDAR

            </button>

        </div>

    `;


    /* =====================================================
       AÇÕES
    ====================================================== */

    article
        .querySelectorAll("[data-action]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const action =
                        button.dataset.action;

                    const picking_id =
                        Number(
                            button.dataset.pickingId
                        );

                    handleAction(
                        action,
                        picking_id
                    );

                }
            );

        });


    /* =====================================================
       QUANTIDADE
    ====================================================== */

    const quantityInput =
        article.querySelector(".quantity-input");

        quantityInput.addEventListener(
            "change",
            async () => {

            if (actionInProgress) {
                return;
            }

            const value =
                Number(quantityInput.value);

            if (
                Number.isNaN(value) ||
                value < 0
            ) {

                quantityInput.value =
                    picking.receivedQuantity;

                return;
            }

            picking.receivedQuantity = value;

            showLoading();

            try {

                const response = await fetch(
                    "/api/received_quantity",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            picking_id: picking.id,
                            received_quantity: value
                        })
                    }
                );

                const data =
                    await response.json();

                console.log(response, data);

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Erro ao atualizar quantidade."
                    );
                }

                showToast(
                    "Quantidade atualizada.",
                    "✓"
                );

            } catch (error) {

                console.error(
                    "Erro ao atualizar quantidade:",
                    error
                );

                showToast(
                    "Erro ao atualizar quantidade.",
                    "✕"
                );

            }

            finally {

                hideLoading();

            }

        }
    );



    return article;

}


/* =========================================================
   AÇÕES DOS PEDIDOS
========================================================= */

function handleAction(action, picking_id) {
    if (actionInProgress) return;

    const picking = findPicking(picking_id);
    if (!picking) return;

    currentPickingId = picking_id;

    if (action === "barcode" && !picking.photosRegistered) {
        showToast(
            "É necessário registrar as fotos antes de ler o código de barras.",
            "!"
        );
        return;
    }

    if (action === "quality" && !picking.photosRegistered) {
        showToast(
            "É necessário registrar as fotos antes de abrir o alerta de qualidade.",
            "!"
        );
        return;
    }

    if (
        action === "validate" &&
        (
            !picking.photosRegistered ||
            !picking.barcodeRegistered
        )
    ) {
        showToast(
            "É necessário registrar as fotos e o código de barras antes de validar o pedido.",
            "!"
        );
        return;
    }

    switch (action) {
        case "photos":
            openPhotoModal(picking);
            break;

        case "validate":
            openValidationModal(picking);
            break;

        case "chat":
            openChatPanel(picking);
            break;

        case "barcode":
            openBarcodeScanner(picking_id);
            break;

        case "quality":
            openQualityModal(picking);
            break;

        case "print":
            printLabel(picking);
            break;
    }
}


/* =========================================================
   ENCONTRAR PEDIDO
========================================================= */

function findPicking(picking_id) {

    return pickings.find(
        picking => picking.id === picking_id
    );

}


/* =========================================================
   ABRIR / FECHAR
========================================================= */

function openModal(id) {

    window.AppUI.openModal(id);

}


function closeModal(id) {

    if (id === "barcodeScannerModal") {
        stopBarcodeScanner();
    }


    if (id === "chatPanel") {
        closeChatPanel();
        return;
    }


    window.AppUI.closeModal(id);

}


/* =========================================================
   LEITOR DE CÓDIGO DE BARRAS
========================================================= */

function setupBarcodeScanner() {

    if (!barcodeScannerVideo || !barcodeScannerStatus) {
        return;
    }

    window.addEventListener(
        "pagehide",
        stopBarcodeScanner
    );

    document.addEventListener(
        "app:modal-close",
        event => {

            if (
                event.detail?.id ===
                "barcodeScannerModal"
            ) {
                stopBarcodeScanner();
            }

        }
    );

}


async function openBarcodeScanner(pickingId) {

    if (barcodeScannerActive) {
        return;
    }

    openModal("barcodeScannerModal");

    barcodeScannerStatus.textContent =
        "Solicitando acesso à câmera...";

    barcodeScannerPickingId = pickingId;

    barcodeScannerActive = true;

    barcodeScannerReader =
        window.AppUI.createBarcodeScanner(
            {
                video: barcodeScannerVideo,
                onResult: handleBarcodeScanResult,
                onError: error => {
                    barcodeScannerStatus.textContent =
                        getBarcodeScannerErrorMessage(error);
                }
            }
        );

    try {

        barcodeScannerControls =
            await barcodeScannerReader.start();


        if (!barcodeScannerActive) {
            barcodeScannerReader.stop();
        }

    } catch (error) {

        barcodeScannerActive = false;

        barcodeScannerStatus.textContent =
            getBarcodeScannerErrorMessage(error);

        console.error(
            "Erro ao iniciar o leitor de código de barras:",
            error
        );

    }

}


async function handleBarcodeScanResult(result) {

    if (!barcodeScannerActive || !result) {
        return;
    }

    const barcode =
        result.getText().trim();

    if (!barcode) {
        return;
    }

    barcodeScannerStatus.textContent =
        "Enviando código lido...";

    barcodeScannerActive = false;

    try {

        const response =
            await fetch(
                `/api/recebimento-qualidade/pickings/${barcodeScannerPickingId}/barcode`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        barcode
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Não foi possível enviar o código lido."
            );

        }

        const picking = findPicking(barcodeScannerPickingId);

        if (picking) {
            picking.barcodeRegistered = true;
        }

        closeModal("barcodeScannerModal");

        showToast(
            `CÓDIGO ENVIADO: ${barcode}`,
            "✓"
        );

    } catch (error) {

        console.error(
            "Erro ao enviar código de barras:",
            error
        );

        barcodeScannerStatus.textContent =
            error.message ||
            "Não foi possível enviar o código. Tente novamente.";

        barcodeScannerActive = true;

    }

}


function stopBarcodeScanner() {

    barcodeScannerActive = false;

    barcodeScannerReader?.stop();

    barcodeScannerControls = null;

    barcodeScannerReader = null;

    barcodeScannerPickingId = null;

}


function getBarcodeScannerErrorMessage(error) {

    if (
        error?.name === "NotAllowedError" ||
        error?.name === "SecurityError"
    ) {
        return "Permita o acesso à câmera para realizar a leitura.";
    }

    if (
        error?.name === "NotFoundError" ||
        error?.name === "OverconstrainedError"
    ) {
        return "Nenhuma câmera compatível foi encontrada.";
    }

    return "Não foi possível iniciar a câmera. Tente novamente.";

}


/* =========================================================
   FOTOS
========================================================= */

function setupPhotoSlots() {

    document
        .getElementById(
            "finishPhotosButton"
        )
        .addEventListener(
            "click",
            savePhotos
        );

}


function setupPhotoInput() {

    photoCameraInput.addEventListener(
        "change",
        handlePhotoSelection
    );

}


function preparePhotoSelection(input) {

    if (photosSaving) {
        return false;
    }

    currentPhotoIndex =
        photoSession.length;

    input.value = "";

    return true;

}


function handlePhotoSelection(event) {

    const file =
        event.target.files[0];

    if (!file) {
        return;
    }

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        showToast(
            "Selecione uma imagem válida.",
            "!"
        );

        return;

    }

    if (currentPhotoIndex === null) {
        return;
    }

    const reader =
        new FileReader();

    reader.onload = () => {

        photoSession.push(
            reader.result
        );

        currentPhotoIndex =
            null;

        updatePhotoInterface();

        showToast(
            `FOTO ${photoSession.length} ADICIONADA`,
            "✓"
        );

    };


    reader.onerror = () => {

        showToast(
            "Não foi possível carregar a foto.",
            "!"
        );

    };


    reader.readAsDataURL(file);

}


function openPhotoModal(picking) {

    currentPickingId =
        picking.id;

    photoSession = [];

    currentPhotoIndex = null;

    photosSaving = false;


    document.getElementById(
        "photoPickingInfo"
    ).textContent =
        `${picking.pv} • ${picking.product}`;


    updatePhotoInterface();


    openModal(
        "photoModal"
    );

}


function updatePhotoInterface() {

    const grid =
        document.getElementById(
            "photoGrid"
        );

    const finishButton =
        document.getElementById(
            "finishPhotosButton"
        );

    const progressText =
        document.getElementById(
            "photoProgressText"
        );

    const progressBar =
        document.getElementById(
            "photoProgressBar"
        );

    const photoMessage =
        document.getElementById(
            "photoMessage"
        );

    const photoInstruction =
        document.getElementById(
            "photoInstruction"
        );


    if (
        !grid ||
        !finishButton ||
        !progressText ||
        !progressBar ||
        !photoMessage ||
        !photoInstruction
    ) {
        return;
    }


    grid.innerHTML = "";


    photoSession.forEach(
        (photo, index) => {

            const slot =
                document.createElement(
                    "div"
                );

            slot.className =
                "photo-slot";


            const preview =
                document.createElement(
                    "img"
                );

            preview.className =
                "photo-preview";

            preview.src =
                photo;

            preview.alt =
                `Foto ${index + 1}`;


            const removeButton =
                document.createElement(
                    "button"
                );

            removeButton.type =
                "button";

            removeButton.className =
                "remove-photo-button";

            removeButton.textContent =
                "×";

            removeButton.title =
                "Excluir foto";


            removeButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();

                    removePhoto(index);

                }
            );


            slot.appendChild(
                preview
            );

            slot.appendChild(
                removeButton
            );

            grid.appendChild(
                slot
            );

        }
    );


    const addPhotoButton =
        document.createElement(
            "label"
        );

    addPhotoButton.className =
        "add-photo-button";

    addPhotoButton.htmlFor =
        "photoCameraInput";


    addPhotoButton.innerHTML = `
        <div class="camera-icon">
            📷
        </div>

        <span>
            TIRAR FOTO
        </span>
    `;


    addPhotoButton.addEventListener(
        "click",
        event => {

            if (
                !preparePhotoSelection(
                    photoCameraInput
                )
            ) {
                event.preventDefault();
            }

        }
    );


    grid.appendChild(
        addPhotoButton
    );

    const completed =
        photoSession.length;


    progressText.textContent =
        `${completed} FOTOS`;


    // Orientação para as três primeiras fotos
    if (completed < photoInstructions.length) {
        photoInstruction.textContent =
            photoInstructions[completed];
    } else {
        photoInstruction.textContent =
            "Tirar fotos adicionais, se necessário";
    }

    /*
     * Não existe mais limite superior.
     *
     * Para manter a barra visualmente útil,
     * ela chega a 100% quando o mínimo de
     * 3 fotos é atingido.
     */

    const progressPercentage =
        Math.min(
            (completed / 3) * 100,
            100
        );


    progressBar.style.width =
        `${progressPercentage}%`;


    finishButton.disabled =
        completed < 3 ||
        photosSaving;


    if (completed < 3) {

        photoMessage.textContent =
            `Faltam ${3 - completed} foto(s). É necessário registrar pelo menos 3 fotos.`;

    } else {

        photoMessage.textContent =
            `✓ ${completed} fotos adicionadas. Você pode registrar as fotos.`;

    }

}


function removePhoto(index) {

    if (photosSaving) {
        return;
    }

    if (
        index < 0 ||
        index >= photoSession.length
    ) {
        return;
    }

    photoSession.splice(
        index,
        1
    );

    updatePhotoInterface();

    showToast(
        "FOTO REMOVIDA",
        "✓"
    );

}


async function savePhotos() {

    const picking =
        findPicking(currentPickingId);


    if (!picking) {
        return;
    }


    if (photoSession.length < 3) {

        showToast(
            "É necessário registrar pelo menos 3 fotos.",
            "!"
        );

        return;

    }


    if (photosSaving) {
        return;
    }


    if (actionInProgress) {
        return;
    }


    const finishButton =
        document.getElementById(
            "finishPhotosButton"
        );


    photosSaving = true;

    showLoading();


    const originalText =
        finishButton.textContent;


    finishButton.disabled =
        true;

    finishButton.textContent =
        "REGISTRANDO...";


    try {

        const response =
            await fetch(
                "/api/recebimento-qualidade/pickings/photos",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        picking_id:
                            picking.id,

                        photos:
                            photoSession
                    })
                }
            );


        let data = null;

        try {

            data =
                await response.json();

        } catch (error) {

            data = null;

        }


        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Não foi possível registrar as fotos."
            );

        }


        /*
         * As fotos só são consideradas
         * definitivamente registradas
         * depois da confirmação do backend.
         */

        picking.photosRegistered =
            true;

        picking.photoCount =
            photoSession.length;


        closeModal(
            "photoModal"
        );


        photoSession = [];

        currentPhotoIndex = null;


        render();


        showToast(
            `${picking.photoCount} FOTOS REGISTRADAS COM SUCESSO`,
            "✓"
        );


    } catch (error) {

        console.error(
            "Erro ao registrar fotos:",
            error
        );


        showToast(
            error.message ||
            "Não foi possível registrar as fotos.",
            "!"
        );


    } finally {

        photosSaving = false;

        finishButton.disabled =
            photoSession.length < 3;

        finishButton.textContent =
            originalText;

        hideLoading();

    }

}

/* =========================================================
   VALIDAÇÃO
========================================================= */

function openValidationModal(picking) {

    currentPickingId =
        picking.id;


    const warning =
        document.getElementById(
            "quantityWarning"
        );


    const isLower =
        picking.receivedQuantity
        <
        picking.expectedQuantity;


    if (isLower) {

        warning.classList.remove(
            "hidden"
        );

    } else {

        warning.classList.add(
            "hidden"
        );

    }


    document.getElementById(
        "validationText"
    ).textContent =
        `Deseja realmente validar o pedido ${picking.pv}?`;


    openModal(
        "validationModal"
    );

}


function setupQuantityValidation() {

    document
        .getElementById(
            "confirmValidation"
        )
        .addEventListener(
            "click",
            validatePicking
        );

}


async function validatePicking() {

    const picking =
        findPicking(currentPickingId);


    if (!picking) return;


    if (!picking.photosRegistered) {

        closeModal(
            "validationModal"
        );

        showToast(
            "É necessário registrar pelo menos 3 fotos antes de validar o pedido.",
            "!"
        );

        return;

    }

    if (!picking.barcodeRegistered) {
       
        closeModal("validationModal");

        showToast("É necessário registrar o código de barras antes de validar o pedido.", "!");

        return;

    }


    if (actionInProgress) {
        return;
    }


    const confirmButton =
        document.getElementById(
            "confirmValidation"
        );


    confirmButton.disabled =
        true;


    const originalText =
        confirmButton.textContent;


    confirmButton.textContent =
        "VALIDANDO...";


    showLoading();


    try {

        const response =
            await fetch(
                `/api/recebimento-qualidade/pickings/${picking.id}/validar`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );


        let data = null;


        try {

            data =
                await response.json();

        } catch (error) {

            data = null;

        }


        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Não foi possível validar o recebimento no Odoo."
            );

        }


        /*
         * Só altera o estado local
         * depois que o Odoo confirmou.
         */

        picking.validated =
            true;


        closeModal(
            "validationModal"
        );


        render();


        showToast(
            "PEDIDO VALIDADO COM SUCESSO",
            "✓"
        );


    } catch (error) {

        console.error(
            "Erro ao validar pedido:",
            error
        );


        showToast(
            error.message ||
            "Não foi possível validar o recebimento.",
            "!"
        );


    } finally {

        hideLoading();

        confirmButton.disabled =
            false;

        confirmButton.textContent =
            originalText;

    }

}


/* =========================================================
   ALERTA DE QUALIDADE
========================================================= */

function openQualityModal(picking) {

    currentPickingId =
        picking.id;


    document.getElementById(
        "qualityPickingInfo"
    ).textContent =
        `${picking.pv} • ${picking.product}`;


    const form =
        document.getElementById(
            "qualityForm"
        );


    form.reset();


    resetQualityCauses();


    document.getElementById(
        "partialQuantityGroup"
    ).classList.add(
        "hidden"
    );


    openModal(
        "qualityModal"
    );

}


/* =========================================================
   FORMULÁRIO DE QUALIDADE
========================================================= */

function setupQualityForm() {

    const rejectionOptions =
        document.querySelectorAll(
            'input[name="reprovacao"]'
        );


    rejectionOptions.forEach(
        input => {

            input.addEventListener(
                "change",
                updateRejectionFields
            );

        }
    );


    document
        .getElementById(
            "qualityForm"
        )
        .addEventListener(
            "submit",
            submitQualityAlert
        );

}


function updateRejectionFields() {

    const selected =
        document.querySelector(
            'input[name="reprovacao"]:checked'
        );


    const group =
        document.getElementById(
            "partialQuantityGroup"
        );


    if (
        selected
        &&
        selected.value === "parcial"
    ) {

        group.classList.remove(
            "hidden"
        );

    } else {

        group.classList.add(
            "hidden"
        );

    }

}



/* =========================================================
   CAUSAS DA NÃO CONFORMIDADE
========================================================= */

function setupQualityCauses() {

    const causesSelector =
        document.getElementById(
            "causas_nao_conformidade"
        );

    const causesDropdown =
        document.getElementById(
            "causesDropdown"
        );


    if (
        !causesSelector ||
        !causesDropdown
    ) {

        console.error(
            "Elementos do seletor de causas não encontrados."
        );

        return;

    }


    causesSelector.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            const isOpen =
                !causesDropdown.classList.contains(
                    "hidden"
                );


            if (isOpen) {

                closeCausesDropdown();

            } else {

                openCausesDropdown();

            }

        }
    );


    causesSelector.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
                ||
                event.key === " "
            ) {

                event.preventDefault();

                event.stopPropagation();

                const isOpen =
                    !causesDropdown.classList.contains(
                        "hidden"
                    );


                if (isOpen) {

                    closeCausesDropdown();

                } else {

                    openCausesDropdown();

                }

            }

        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                !causesSelector.contains(
                    event.target
                )
                &&
                !causesDropdown.contains(
                    event.target
                )
            ) {

                closeCausesDropdown();

            }

        }
    );


    loadQualityCauses();

}


async function loadQualityCauses() {

    const causesList =
        document.getElementById(
            "causesList"
        );


    if (!causesList) {

        console.error(
            "Elemento causesList não encontrado."
        );

        return;

    }


    causesList.innerHTML = `
        <div class="causes-loading">
            CARREGANDO CAUSAS...
        </div>
    `;


    try {

        const response =
            await fetch(
                "/api/quality-alert/causas"
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Não foi possível carregar as causas."
            );

        }


        if (!Array.isArray(data)) {

            throw new Error(
                "Formato inválido das causas."
            );

        }


        qualityCauses = data;

        renderQualityCauses();


    } catch (error) {

        console.error(
            "Erro ao carregar causas de não conformidade:",
            error
        );


        causesList.innerHTML = `
            <div class="causes-error">
                Não foi possível carregar as causas.
            </div>
        `;

    }

}


function renderQualityCauses() {

    const causesList =
        document.getElementById(
            "causesList"
        );


    if (!causesList) {
        return;
    }


    causesList.innerHTML = "";


    if (qualityCauses.length === 0) {

        causesList.innerHTML = `
            <div class="causes-empty">
                Nenhuma causa cadastrada no Odoo.
            </div>
        `;

        return;

    }


    qualityCauses.forEach(
        cause => {

            const button =
                document.createElement(
                    "button"
                );


            button.type = "button";

            button.className =
                "cause-option";


            button.dataset.causeId =
                cause.id;


            button.innerHTML = `

                <span class="cause-check">
                    ✓
                </span>

                <span class="cause-option-name">
                    ${escapeHtml(cause.name)}
                </span>

            `;


            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();

                    toggleQualityCause(
                        cause.id
                    );

                }
            );


            causesList.appendChild(
                button
            );

        }
    );


    updateQualityCausesInterface();

}


function openCausesDropdown() {

    const causesDropdown =
        document.getElementById(
            "causesDropdown"
        );

    const causesSelector =
        document.getElementById(
            "causas_nao_conformidade"
        );


    if (
        !causesDropdown ||
        !causesSelector
    ) {
        return;
    }


    causesDropdown.classList.remove(
        "hidden"
    );


    causesSelector.classList.add(
        "open"
    );


    updateQualityCausesInterface();

}


function closeCausesDropdown() {

    const causesDropdown =
        document.getElementById(
            "causesDropdown"
        );

    const causesSelector =
        document.getElementById(
            "causas_nao_conformidade"
        );


    if (!causesDropdown) {
        return;
    }


    causesDropdown.classList.add(
        "hidden"
    );


    if (causesSelector) {

        causesSelector.classList.remove(
            "open"
        );

    }

}


function toggleQualityCause(causeId) {

    const numericCauseId =
        Number(causeId);


    const index =
        selectedQualityCauses.indexOf(
            numericCauseId
        );


    if (index === -1) {

        selectedQualityCauses.push(
            numericCauseId
        );

    } else {

        selectedQualityCauses.splice(
            index,
            1
        );

    }


    updateQualityCausesInterface();

}


function updateQualityCausesInterface() {

    const selectedCausesContainer =
        document.getElementById(
            "selectedCauses"
        );


    if (!selectedCausesContainer) {
        return;
    }


    /*
     * Atualiza os checks da lista.
     */

    document
        .querySelectorAll(
            ".cause-option"
        )
        .forEach(
            option => {

                const causeId =
                    Number(
                        option.dataset.causeId
                    );


                const selected =
                    selectedQualityCauses.includes(
                        causeId
                    );


                option.classList.toggle(
                    "selected",
                    selected
                );

            }
        );


    /*
     * Atualiza as causas exibidas
     * dentro da caixa principal.
     */

    selectedCausesContainer.innerHTML = "";


    if (
        selectedQualityCauses.length === 0
    ) {

        const placeholder =
            document.createElement(
                "span"
            );


        placeholder.className =
            "cause-placeholder";


        placeholder.textContent =
            "Selecione uma ou mais causas...";


        selectedCausesContainer.appendChild(
            placeholder
        );


        return;

    }


    selectedQualityCauses.forEach(
        causeId => {

            const cause =
                qualityCauses.find(
                    item =>
                        Number(item.id) ===
                        causeId
                );


            if (!cause) {
                return;
            }


            const selectedCause =
                document.createElement(
                    "span"
                );


            selectedCause.className =
                "selected-cause";


            selectedCause.textContent =
                cause.name;


            selectedCausesContainer.appendChild(
                selectedCause
            );

        }
    );

}


function resetQualityCauses() {

    selectedQualityCauses = [];

    updateQualityCausesInterface();

    closeCausesDropdown();

}


function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value ?? "";


    return div.innerHTML;

}


/* =========================================================
   SALVAR ALERTA
========================================================= */

async function submitQualityAlert(event) {

    event.preventDefault();

    if (actionInProgress) {
        return;
    }


    const picking =
        findPicking(currentPickingId);


    if (!picking) return;


    const selectedRejection =
        document.querySelector(
            'input[name="reprovacao"]:checked'
        );


    if (!selectedRejection) {

        showToast(
            "Selecione o tipo de reprovação.",
            "!"
        );

        return;

    }


    const reprovacao =
        selectedRejection.value;


    const quantidade_nao_conforme =
        Number(
            document.getElementById(
                "quantidade_nao_conforme"
            ).value
        );


    const descricao_geral =
        document.getElementById(
            "descricao_geral"
        ).value.trim();


    const especificado_quality =
        document.getElementById(
            "especificado_quality"
        ).value.trim();


    const encontrado_quality =
        document.getElementById(
            "encontrado_quality"
        ).value.trim();


    if (!descricao_geral) {

        showToast(
            "Informe a descrição do problema.",
            "!"
        );

        return;

    }


    if (
        reprovacao === "parcial"
        &&
        (
            !quantidade_nao_conforme
            ||
            quantidade_nao_conforme <= 0
        )
    ) {

        showToast(
            "Informe a quantidade reprovada.",
            "!"
        );

        return;

    }

    // ------------------------------------------------
    // Monta os dados do frontend que serão enviados para o backend
    // ------------------------------------------------

    const quality_alert_data = {
        picking_id: picking.id,

        causas_qa_id:
            selectedQualityCauses,

        reprovacao,

        quantidade_nao_conforme:
            reprovacao === "parcial"
                ? quantidade_nao_conforme
                : picking.receivedQuantity,

        descricao_geral,

        especificado_quality,

        encontrado_quality
    };

    // ------------------------------------------------
    // Envia os dados para o FastAPI
    // ------------------------------------------------
    
    showLoading();
    
    try{
        const response = await fetch("/api/quality-alert", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(quality_alert_data)});

        if (!response.ok) {
            showToast("Erro ao registrar alerta de qualidade.", "!");
            return;
        }

        const resultado = await response.json();

        // ------------------------------------------------
        // Atualiza a tela após confirmado envio para o backend
        // ------------------------------------------------

        picking.qualityAlert = {
            ...quality_alert_data,

            causas_qa_id: [
                ...selectedQualityCauses
            ]
        };

        closeModal("qualityModal");

        render();

        showToast("ALERTA DE QUALIDADE REGISTRADO", "✓");
    }

    catch (error) {
        console.error("Erro ao registrar alerta de qualidade:", error);
        showToast("Erro ao registrar alerta de qualidade.", "!");
    }

    finally {

        hideLoading();

    }
}


/* =========================================================
   IMPRESSÃO
========================================================= */

async function printLabel(picking) {

    if (actionInProgress) {
        return;
    }

    showLoading();

    try {

        const response =
            await fetch(
                `/api/recebimento-qualidade/${picking.id}/imprimir-etiqueta`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Não foi possível imprimir a etiqueta."
            );

        }

        const {
            iot_url,
            payload
        } = data;

        if (!iot_url || !payload) {

            throw new Error(
                "Resposta inválida do servidor para impressão: Faltando iot_url ou payload"
            );

        }

        const iotResponse =
            await fetch(
                iot_url,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        const iotBody =
            await iotResponse.json().catch(
                () => ({
                    raw:
                        iotResponse.statusText
                })
            );

        if (!iotResponse.ok) {

            throw new Error(
                `Erro IoT: ${iotResponse.status} - ${JSON.stringify(iotBody)}`
            );

        }

        showToast(
            `ETIQUETA DO ${picking.pv} ENVIADA PARA IMPRESSÃO`,
            "✓"
        );


    } catch (error) {

        console.error(
            "Erro ao imprimir etiqueta:",
            error
        );

        showToast(
            error.message ||
            "Não foi possível imprimir a etiqueta.",
            "!"
        );

    }

    finally {

        hideLoading();

    }

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    icon = "✓"
) {
    window.AppUI.showToast(message, icon);

}



/* =========================================================
   CHAT DO RECEBIMENTO
========================================================= */

function setupChat() {

    if (
        !chatPanel ||
        !chatPickingInfo ||
        !chatMessagesContainer ||
        !chatForm ||
        !chatInput
    ) {
        return;
    }


    chatForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            sendChatMessage();

        }
    );

    document
        .querySelectorAll('[data-close="chatPanel"]')
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    closeChatPanel();

                }
            );

        });


    chatInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendChatMessage();

            }

        }
    );


    chatSendButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            sendChatMessage();

        }
    );

}


/* =========================================================
   ABRIR CHAT
========================================================= */

function openChatPanel(picking) {

    if (!picking) {
        return;
    }


    currentChatPickingId =
        picking.id;


    chatPickingInfo.textContent =
        `${picking.pv} • ${picking.product}`;


    if (
        !chatMessages[
            picking.id
        ]
    ) {

        chatMessages[
            picking.id
        ] = [];

    }


    renderChatMessages();


    chatPanel.classList.remove(
        "hidden"
    );


    chatPanel.setAttribute(
        "aria-hidden",
        "false"
    );


    setTimeout(
        () => {

            chatInput?.focus();

        },
        100
    );

}


/* =========================================================
   FECHAR CHAT
========================================================= */

function closeChatPanel() {

    if (!chatPanel) {
        return;
    }


    chatPanel.classList.add(
        "hidden"
    );


    chatPanel.setAttribute(
        "aria-hidden",
        "true"
    );


    currentChatPickingId =
        null;

}


/* =========================================================
   RENDER DAS MENSAGENS
========================================================= */

function renderChatMessages() {

    if (
        !chatMessagesContainer ||
        currentChatPickingId === null
    ) {
        return;
    }


    const messages =
        chatMessages[
            currentChatPickingId
        ] || [];


    chatMessagesContainer.innerHTML = "";


    if (messages.length === 0) {

        const emptyMessage =
            document.createElement(
                "div"
            );


        emptyMessage.className =
            "chat-empty";


        emptyMessage.textContent =
            "Nenhuma mensagem ainda. Inicie uma conversa sobre este recebimento.";


        chatMessagesContainer.appendChild(
            emptyMessage
        );


        return;

    }


    messages.forEach(
        message => {

            const messageElement =
                document.createElement(
                    "div"
                );


            messageElement.className =
                `chat-message ${
                    message.sender === "user"
                        ? "sent"
                        : "received"
                }`;


            const author =
                document.createElement(
                    "span"
                );


            author.className =
                "chat-message-author";


            author.textContent =
                message.sender === "user"
                    ? "Você"
                    : "Sistema";


            const text =
                document.createElement(
                    "span"
                );


            text.className =
                "chat-message-text";


            text.textContent =
                message.text;


            messageElement.appendChild(
                author
            );


            messageElement.appendChild(
                text
            );


            chatMessagesContainer.appendChild(
                messageElement
            );

        }
    );


    chatMessagesContainer.scrollTop =
        chatMessagesContainer.scrollHeight;

}



/* =========================================================
   BADGE DO CHAT
========================================================= */

function updateChatBadge(pickingId) {

    const chatTab =
        document.querySelector(
            `.chat-tab[data-picking-id="${pickingId}"]`
        );


    if (!chatTab) {
        return;
    }


    const hasMessages =
        Array.isArray(
            chatMessages[pickingId]
        )
        &&
        chatMessages[pickingId].length > 0;


    chatTab.classList.toggle(
        "has-messages",
        hasMessages
    );

}



/* =========================================================
   ENVIAR MENSAGEM
========================================================= */

function sendChatMessage() {

    if (
        currentChatPickingId === null ||
        !chatInput
    ) {
        return;
    }


    const text =
        chatInput.value.trim();


    if (!text) {
        return;
    }


    if (
        !chatMessages[
            currentChatPickingId
        ]
    ) {

        chatMessages[
            currentChatPickingId
        ] = [];

    }


    chatMessages[
        currentChatPickingId
    ].push({

        sender: "user",

        text

    });

    updateChatBadge(
        currentChatPickingId
    );


    chatInput.value = "";


    renderChatMessages();


    /*
     * V1:
     * O chat ainda não possui backend.
     *
     * Esta resposta apenas simula uma
     * confirmação para demonstrar o fluxo.
     */

    setTimeout(
        () => {

            if (
                currentChatPickingId === null
            ) {
                return;
            }


            chatMessages[
                currentChatPickingId
            ].push({

                sender: "system",

                text:
                    "Mensagem registrada no chat. A integração com o backend será adicionada posteriormente."

            });


            renderChatMessages();

        },
        500
    );

}