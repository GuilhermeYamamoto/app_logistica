/* =========================================================
   RECEBIMENTO QUALIDADE - V6
========================================================= */


let orders = [];


/* =========================================================
   ESTADO DA INTERFACE
========================================================= */

let currentFilter = "pendentes";

let searchTerm = "";

let filteredPickingIds = null;

let currentOrderId = null;

let currentPhotoIndex = null;

let toastTimeout = null;


/* =========================================================
   ELEMENTOS
========================================================= */

const ordersContainer =
    document.getElementById("ordersContainer");

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

const photoInput =
    document.getElementById("photoInput");

const qualityRecordsElement =
    document.getElementById("qualityRecords");


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupDashboard();

    setupSearch();

    setupModalButtons();

    setupPhotoSlots();

    setupPhotoInput();

    setupQualityForm();

    setupQuantityValidation();

    loadOrders();

});


async function loadOrders() {

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

        orders = records.map(order => ({

            ...order,

            photos: [
                null,
                null,
                null
            ],

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

}


/* =========================================================
   STATUS
========================================================= */

function getOrderStatus(order) {

    if (order.validated) {

        return {
            label: "CONCLUÍDO",
            className: "status-completed"
        };

    }


    if (
        order.photos.every(
            photo => photo !== null
        )
    ) {

        return {
            label: "PRONTO PARA VALIDAR",
            className: "status-ready"
        };

    }


    if (
        order.photos.some(
            photo => photo !== null
        )
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

function belongsToFilter(order) {

    switch (currentFilter) {

        case "todos":

            return true;


        case "pendentes":

            return !order.validated;


        case "andamento":

            return (
                !order.validated
                &&
                order.photos.some(
                    photo => photo !== null
                )
            );



        case "concluidos":

            return order.validated;


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

    const filteredOrders =
        orders.filter(order => {

            const matchesFilter =
                belongsToFilter(order);

            const matchesSearch =
                filteredPickingIds === null
                ||
                filteredPickingIds.includes(order.id);

            return (
                matchesFilter
                &&
                matchesSearch
            );

        });


    ordersContainer.innerHTML = "";


    filteredOrders.forEach(order => {

        ordersContainer.appendChild(
            createOrderCard(order)
        );

    });


    resultCount.textContent =
        `${filteredOrders.length} ${
            filteredOrders.length === 1
                ? "pedido"
                : "pedidos"
        }`;


    if (
        filteredOrders.length === 0
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
        orders.length; 


    const pending =
        orders.filter(
            order => !order.validated
        ).length;


    const progress =
        orders.filter(
            order =>
                !order.validated
                &&
                order.photos.some(
                    photo => photo !== null
                )
        ).length;



    const completed =
        orders.filter(
            order => order.validated
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

function createOrderCard(order) {

    const article =
        document.createElement("article");


    article.className =
        "order-card";


    if (order.validated) {

        article.classList.add(
            "completed-card"
        );

    }


    const status =
        getOrderStatus(order);


    const photosComplete =
        order.photos.every(
            photo => photo !== null
        );


    const validationAvailable =
        photosComplete;



    article.innerHTML = `

        <div class="order-main">

            <div class="order-identification">

                <strong>
                    ${order.pv}
                </strong>

                <div class="order-status ${status.className}">
                    ${status.label}
                </div>

            </div>


            <div class="client-info">

                <strong>
                    ${order.client}
                </strong>

                <span>
                    Cliente
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
                    value="${order.receivedQuantity}"
                    data-order-id="${order.id}"
                >

                <span class="expected-quantity">
                    Esperado: ${order.expectedQuantity} unidades
                </span>

            </div>


            <div>

                <strong>
                    Produto:<br/><br/>
                </strong>

                <h3>
                    ${order.product}
                </h3>

            </div>

        </div>


        <div class="order-actions">

            <button
                class="main-action photo-action"
                data-action="photos"
                data-order-id="${order.id}"
            >

                <span class="action-icon-small">
                    📷
                </span>

                FOTOS

            </button>


            <button
                class="main-action validation-action
                    ${validationAvailable ? "" : "disabled"}"
                data-action="validate"
                data-order-id="${order.id}"
                ${validationAvailable ? "" : "disabled"}
            >

                <span class="action-icon-small">
                    ✓
                </span>

                VALIDAR

            </button>

        </div>


        <div class="secondary-actions">

            <button
                class="secondary-action quality-action"
                data-action="quality"
                data-order-id="${order.id}"
            >

                ⚠️ ALERTA DE QUALIDADE

            </button>


            <button
                class="secondary-action print-action"
                data-action="print"
                data-order-id="${order.id}"
            >

                🖨️ IMPRIMIR ETIQUETA

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

                    const orderId =
                        Number(
                            button.dataset.orderId
                        );

                    handleAction(
                        action,
                        orderId
                    );

                }
            );

        });


    /* =====================================================
       QUANTIDADE
    ====================================================== */

    const quantityInput =
        article.querySelector(
            ".quantity-input"
        );


    quantityInput.addEventListener(
        "change",
        () => {

            const value =
                Number(
                    quantityInput.value
                );


            if (
                Number.isNaN(value)
                ||
                value < 0
            ) {

                quantityInput.value =
                    order.receivedQuantity;

                return;

            }


            order.receivedQuantity =
                value;


            showToast(
                "Quantidade atualizada.",
                "✓"
            );

        }
    );


    return article;

}


/* =========================================================
   AÇÕES DOS PEDIDOS
========================================================= */

function handleAction(
    action,
    orderId
) {

    const order =
        findOrder(orderId);


    if (!order) return;


    currentOrderId =
        orderId;


    switch (action) {

        case "photos":

            openPhotoModal(order);

            break;


        case "validate":

            openValidationModal(order);

            break;


        case "quality":

            openQualityModal(order);

            break;


        case "print":

            printLabel(order);

            break;

    }

}


/* =========================================================
   ENCONTRAR PEDIDO
========================================================= */

function findOrder(orderId) {

    return orders.find(
        order => order.id === orderId
    );

}


/* =========================================================
   MODAIS
========================================================= */

function setupModalButtons() {

    document
        .querySelectorAll("[data-close]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset.close
                    );

                }
            );

        });


    document
        .querySelectorAll(".modal-overlay")
        .forEach(overlay => {

            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target === overlay
                    ) {

                        closeModal(
                            overlay.id
                        );

                    }

                }
            );

        });

}


/* =========================================================
   ABRIR / FECHAR
========================================================= */

function openModal(id) {

    document
        .getElementById(id)
        .classList.remove(
            "hidden"
        );

}


function closeModal(id) {

    document
        .getElementById(id)
        .classList.add(
            "hidden"
        );

}


/* =========================================================
   FOTOS
========================================================= */

function setupPhotoSlots() {

    document
        .querySelectorAll(".photo-slot")
        .forEach(slot => {

            slot.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            slot.dataset.photoIndex
                        );


                    currentPhotoIndex =
                        index;


                    photoInput.value = "";


                    photoInput.click();

                }
            );

        });


    document
        .getElementById(
            "finishPhotosButton"
        )
        .addEventListener(
            "click",
            () => {

                const order =
                    findOrder(
                        currentOrderId
                    );


                if (!order) return;


                if (
                    order.photos.every(
                        photo => photo !== null
                    )
                ) {

                    closeModal(
                        "photoModal"
                    );


                    showToast(
                        "3 FOTOS REGISTRADAS",
                        "✓"
                    );


                    render();

                }

            }
        );

}


/* =========================================================
   SELEÇÃO / CAPTURA DE FOTO
========================================================= */

function setupPhotoInput() {

    photoInput.addEventListener(
        "change",
        handlePhotoSelection
    );

}


/* =========================================================
   PROCESSAR FOTO
========================================================= */

function handlePhotoSelection(event) {

    const file =
        event.target.files[0];


    if (!file) {

        return;

    }


    const order =
        findOrder(currentOrderId);


    if (!order) {

        return;

    }


    if (currentPhotoIndex === null) {

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


    const reader =
        new FileReader();


    reader.onload = () => {

        order.photos[
            currentPhotoIndex
        ] = reader.result;


        const photoNumber =
            currentPhotoIndex + 1;


        updatePhotoInterface();

        render();


        showToast(
            `FOTO ${photoNumber} REGISTRADA`,
            "✓"
        );


        currentPhotoIndex =
            null;

    };


    reader.onerror = () => {

        showToast(
            "Não foi possível carregar a foto.",
            "!"
        );

    };


    reader.readAsDataURL(file);

}


/* =========================================================
   ABRIR MODAL DE FOTOS
========================================================= */

function openPhotoModal(order) {

    currentOrderId =
        order.id;


    document.getElementById(
        "photoOrderInfo"
    ).textContent =
        `${order.pv} • ${order.product}`;


    updatePhotoInterface();

    openModal(
        "photoModal"
    );

}


/* =========================================================
   ATUALIZAR FOTOS
========================================================= */

function updatePhotoInterface() {

    const order =
        findOrder(currentOrderId);


    if (!order) return;


    const completed =
        order.photos.filter(
            photo => photo !== null
        ).length;


    document.getElementById(
        "photoProgressText"
    ).textContent =
        `${completed} DE 3 FOTOS`;


    document.getElementById(
        "photoProgressBar"
    ).style.width =
        `${(completed / 3) * 100}%`;


    document
        .querySelectorAll(".photo-slot")
        .forEach(
            (slot, index) => {

                const preview =
                    slot.querySelector(
                        ".photo-preview"
                    );


                const photo =
                    order.photos[index];


                if (photo) {

                    slot.classList.add(
                        "has-photo"
                    );

                    preview.src =
                        photo;

                } else {

                    slot.classList.remove(
                        "has-photo"
                    );

                    preview.removeAttribute(
                        "src"
                    );

                }

            }
        );


    const finishButton =
        document.getElementById(
            "finishPhotosButton"
        );


    finishButton.disabled =
        completed !== 3;


    if (completed === 3) {

        document.getElementById(
            "photoMessage"
        ).textContent =
            "✓ 3 fotos registradas. Você pode concluir.";

    } else {

        document.getElementById(
            "photoMessage"
        ).textContent =
            `Faltam ${3 - completed} foto(s). Clique em uma câmera para continuar.`;

    }

}


/* =========================================================
   VALIDAÇÃO
========================================================= */

function openValidationModal(order) {

    currentOrderId =
        order.id;


    const warning =
        document.getElementById(
            "quantityWarning"
        );


    const isLower =
        order.receivedQuantity
        <
        order.expectedQuantity;


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
        `Deseja realmente validar o pedido ${order.pv}?`;


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
            validateOrder
        );

}

async function validateOrder() {

    const order =
        findOrder(currentOrderId);

    if (!order) return;


    const photosComplete =
        order.photos.every(
            photo => photo !== null
        );


    if (!photosComplete) {

        closeModal(
            "validationModal"
        );

        showToast(
            "É necessário registrar as 3 fotos.",
            "!"
        );

        return;

    }

    
    const confirmButton =
        document.getElementById(
            "confirmValidation"
        );


    confirmButton.disabled = true;

    const originalText =
        confirmButton.textContent;

    confirmButton.textContent =
        "VALIDANDO...";


    try {

        const response =
            await fetch(
                `/api/recebimento-qualidade/pickings/${order.id}/validar`,
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

        order.validated = true;


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

        confirmButton.disabled =
            false;

        confirmButton.textContent =
            originalText;

    }

}


/* =========================================================
   ALERTA DE QUALIDADE
========================================================= */

function openQualityModal(order) {

    currentOrderId =
        order.id;


    document.getElementById(
        "qualityOrderInfo"
    ).textContent =
        `${order.pv} • ${order.product}`;


    const form =
        document.getElementById(
            "qualityForm"
        );


    form.reset();


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
            'input[name="rejectionType"]'
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
            'input[name="rejectionType"]:checked'
        );


    const group =
        document.getElementById(
            "partialQuantityGroup"
        );


    if (
        selected
        &&
        selected.value === "partial"
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
   SALVAR ALERTA
========================================================= */

function submitQualityAlert(event) {

    event.preventDefault();


    const order =
        findOrder(currentOrderId);


    if (!order) return;


    const selectedRejection =
        document.querySelector(
            'input[name="rejectionType"]:checked'
        );


    if (!selectedRejection) {

        showToast(
            "Selecione o tipo de reprovação.",
            "!"
        );

        return;

    }


    const rejectionType =
        selectedRejection.value;


    const rejectedQuantity =
        Number(
            document.getElementById(
                "rejectedQuantity"
            ).value
        );


    const description =
        document.getElementById(
            "qualityDescription"
        ).value.trim();


    const specified =
        document.getElementById(
            "qualitySpecified"
        ).value.trim();


    const found =
        document.getElementById(
            "qualityFound"
        ).value.trim();


    if (!description) {

        showToast(
            "Informe a descrição do problema.",
            "!"
        );

        return;

    }


    if (
        rejectionType === "partial"
        &&
        (
            !rejectedQuantity
            ||
            rejectedQuantity <= 0
        )
    ) {

        showToast(
            "Informe a quantidade reprovada.",
            "!"
        );

        return;

    }


    order.qualityAlert = {

        rejectionType,

        rejectedQuantity:
            rejectionType === "partial"
                ? rejectedQuantity
                : order.receivedQuantity,

        description,

        specified,

        found,

        createdAt:
            new Date().toISOString()

    };


    closeModal(
        "qualityModal"
    );


    render();


    showToast(
        "ALERTA DE QUALIDADE REGISTRADO",
        "✓"
    );

}


/* =========================================================
   IMPRESSÃO
========================================================= */

async function printLabel(order) {
    try {
        const response = await fetch(
            `/api/recebimento-qualidade/${order.id}/imprimir-etiqueta`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data?.detail ||
                "Não foi possível imprimir a etiqueta."
            );
        }

        showToast(
            `ETIQUETA DO ${order.pv} ENVIADA PARA IMPRESSÃO`,
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
}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    icon = "✓"
) {

    const toast =
        document.getElementById(
            "toast"
        );


    const toastMessage =
        document.getElementById(
            "toastMessage"
        );


    const toastIcon =
        document.getElementById(
            "toastIcon"
        );


    toastMessage.textContent =
        message;


    toastIcon.textContent =
        icon;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimeout
    );


    toastTimeout =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2800
        );

}
