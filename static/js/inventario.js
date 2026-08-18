/* =========================================================
   RECEBIMENTO QUALIDADE
   V1 - PROTÓTIPO FRONT-END
   ========================================================= */


/* =========================================================
   DADOS FICTÍCIOS
   ========================================================= */

const orders = [

    {
        id: 1,
        pv: "PV10001",
        client: "Mercado Central",
        product: "Caixa Organizadora 20L",
        quantity: 12,
        time: "08:15",
        photos: 0,
        packageConfirmed: false,
        validated: false
    },

    {
        id: 2,
        pv: "PV10002",
        client: "Supermercado Bom Preço",
        product: "Kit Ferramentas Profissional",
        quantity: 8,
        time: "08:42",
        photos: 0,
        packageConfirmed: false,
        validated: false
    },

    {
        id: 3,
        pv: "PV10003",
        client: "Casa & Cia",
        product: "Luminária LED 24W",
        quantity: 15,
        time: "09:05",
        photos: 0,
        packageConfirmed: false,
        validated: false
    },

    {
        id: 4,
        pv: "PV10004",
        client: "ConstruMais",
        product: "Torneira Monocomando",
        quantity: 6,
        time: "09:27",
        photos: 0,
        packageConfirmed: false,
        validated: false
    },

    {
        id: 5,
        pv: "PV10005",
        client: "Loja do Lar",
        product: "Jogo de Panelas 5 Peças",
        quantity: 10,
        time: "10:03",
        photos: 0,
        packageConfirmed: false,
        validated: false
    },

    {
        id: 6,
        pv: "PV10006",
        client: "Atacadão Regional",
        product: "Cadeira Dobrável",
        quantity: 20,
        time: "10:31",
        photos: 0,
        packageConfirmed: false,
        validated: false
    },

    {
        id: 7,
        pv: "PV10007",
        client: "Magazine Exemplo",
        product: "Ventilador de Mesa",
        quantity: 9,
        time: "10:55",
        photos: 0,
        packageConfirmed: false,
        validated: false
    },

    {
        id: 8,
        pv: "PV10008",
        client: "Comercial Paulista",
        product: "Caixa de Som Bluetooth",
        quantity: 14,
        time: "11:20",
        photos: 0,
        packageConfirmed: false,
        validated: false
    }

];


/* =========================================================
   ESTADO DA APLICAÇÃO
   ========================================================= */

let currentOrder = null;

let toastTimeout = null;


/* =========================================================
   ELEMENTOS DO DOM
   ========================================================= */

const ordersList =
    document.getElementById("ordersList");

const emptyState =
    document.getElementById("emptyState");

const orderCounter =
    document.getElementById("orderCounter");

const searchInput =
    document.getElementById("searchInput");

const clearSearch =
    document.getElementById("clearSearch");


/* MODAL DE FOTOS */

const photoModal =
    document.getElementById("photoModal");

const photoModalTitle =
    document.getElementById("photoModalTitle");

const closePhotoModal =
    document.getElementById("closePhotoModal");

const cancelPhotoButton =
    document.getElementById("cancelPhotoButton");

const capturePhotoButton =
    document.getElementById("capturePhotoButton");

const confirmPhotosButton =
    document.getElementById("confirmPhotosButton");

const photoCounter =
    document.getElementById("photoCounter");

const photoProgressFill =
    document.getElementById("photoProgressFill");

const cameraTitle =
    document.getElementById("cameraTitle");

const cameraDescription =
    document.getElementById("cameraDescription");


/* MODAL PACOTE */

const packageModal =
    document.getElementById("packageModal");

const packageOrderNumber =
    document.getElementById("packageOrderNumber");

const cancelPackageButton =
    document.getElementById("cancelPackageButton");

const confirmPackageButton =
    document.getElementById("confirmPackageButton");


/* MODAL VALIDAÇÃO */

const validateModal =
    document.getElementById("validateModal");

const validateOrderNumber =
    document.getElementById("validateOrderNumber");

const cancelValidateButton =
    document.getElementById("cancelValidateButton");

const confirmValidateButton =
    document.getElementById("confirmValidateButton");


/* TOAST */

const toast =
    document.getElementById("toast");

const toastIcon =
    document.getElementById("toastIcon");

const toastMessage =
    document.getElementById("toastMessage");


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        renderOrders();

        setupEvents();

    }
);


/* =========================================================
   CONFIGURAÇÃO DOS EVENTOS
   ========================================================= */

function setupEvents() {


    /* PESQUISA */

    searchInput.addEventListener(
        "input",
        handleSearch
    );


    clearSearch.addEventListener(
        "click",
        () => {

            searchInput.value = "";

            handleSearch();

            searchInput.focus();

        }
    );


    /* MODAL FOTOS */

    closePhotoModal.addEventListener(
        "click",
        closePhotoModalWindow
    );


    cancelPhotoButton.addEventListener(
        "click",
        closePhotoModalWindow
    );


    capturePhotoButton.addEventListener(
        "click",
        capturePhoto
    );


    confirmPhotosButton.addEventListener(
        "click",
        confirmPhotos
    );


    /* MODAL PACOTE */

    cancelPackageButton.addEventListener(
        "click",
        closePackageModal
    );


    confirmPackageButton.addEventListener(
        "click",
        confirmPackage
    );


    /* MODAL VALIDAÇÃO */

    cancelValidateButton.addEventListener(
        "click",
        closeValidateModal
    );


    confirmValidateButton.addEventListener(
        "click",
        confirmValidation
    );


    /* ESC FECHA MODAIS */

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {

                closeAllModals();

            }

        }
    );


    /* CLIQUE FORA DO MODAL */

    photoModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === photoModal
            ) {

                closePhotoModalWindow();

            }

        }
    );


    packageModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === packageModal
            ) {

                closePackageModal();

            }

        }
    );


    validateModal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === validateModal
            ) {

                closeValidateModal();

            }

        }
    );
}


/* =========================================================
   RENDERIZAÇÃO DOS PEDIDOS
   ========================================================= */

function renderOrders(
    filteredOrders = orders
) {

    ordersList.innerHTML = "";


    /* CONTADOR */

    const total =
        filteredOrders.length;

    orderCounter.textContent =
        total === 1
            ? "1 pedido"
            : `${total} pedidos`;


    /* NENHUM RESULTADO */

    if (total === 0) {

        emptyState.classList.remove(
            "hidden"
        );

        return;

    }


    emptyState.classList.add(
        "hidden"
    );


    /* CRIA OS CARDS */

    filteredOrders.forEach(
        (order) => {

            const card =
                createOrderCard(order);

            ordersList.appendChild(card);

        }
    );
}


/* =========================================================
   CRIAÇÃO DO CARD
   ========================================================= */

function createOrderCard(order) {

    const card =
        document.createElement("article");


    const isCompleted =
        order.validated;


    card.className =
        `order-card ${
            isCompleted
                ? "completed"
                : ""
        }`;


    /* -----------------------------------------------------
       INFORMAÇÕES
       ----------------------------------------------------- */

    const info =
        document.createElement("div");

    info.className =
        "order-info";


    info.innerHTML = `

        <div class="info-group">

            <span class="info-label">
                PEDIDO
            </span>

            <span class="info-value pv-number">
                ${order.pv}
            </span>

        </div>


        <div class="info-group">

            <span class="info-label">
                CLIENTE
            </span>

            <span class="info-value">
                ${order.client}
            </span>

        </div>


        <div class="info-group">

            <span class="info-label">
                PRODUTO
            </span>

            <span class="info-value">
                ${order.product}
            </span>

        </div>


        <div class="info-group">

            <span class="info-label">
                QTD. / HORÁRIO
            </span>

            <span class="info-value">
                ${order.quantity} un. · ${order.time}
            </span>

        </div>

    `;


    /* -----------------------------------------------------
       BOTÕES
       ----------------------------------------------------- */

    const actions =
        document.createElement("div");

    actions.className =
        "order-actions";


    /* BOTÃO FOTOS */

    const photosButton =
        createStepButton({

            type: "photos",

            icon:
                order.photos >= 3
                    ? "✓"
                    : "📷",

            text:
                order.photos >= 3
                    ? "FOTOS CONCLUÍDAS"
                    : "TIRAR FOTOS",

            state:
                order.photos >= 3
                    ? "completed"
                    : "active"

        });


    photosButton.addEventListener(
        "click",
        () => {

            if (
                order.photos < 3
            ) {

                openPhotoModal(order);

            }

        }
    );


    /* BOTÃO PACOTE */

    const packageButton =
        createStepButton({

            type: "package",

            icon:
                order.packageConfirmed
                    ? "✓"
                    : "📦",

            text:
                order.packageConfirmed
                    ? "PACOTE CONCLUÍDO"
                    : "COLOCAR EM PACOTE",

            state:
                order.packageConfirmed
                    ? "completed"
                    : (
                        order.photos >= 3
                            ? "active"
                            : "locked"
                    )

        });


    packageButton.addEventListener(
        "click",
        () => {

            if (
                order.photos >= 3 &&
                !order.packageConfirmed
            ) {

                openPackageModal(order);

            }

        }
    );


    /* BOTÃO VALIDAR */

    const validateButton =
        createStepButton({

            type: "validate",

            icon:
                order.validated
                    ? "✓"
                    : "✓",

            text:
                order.validated
                    ? "VALIDADO"
                    : "VALIDAR",

            state:
                order.validated
                    ? "completed"
                    : (
                        order.packageConfirmed
                            ? "active"
                            : "locked"
                    )

        });


    validateButton.addEventListener(
        "click",
        () => {

            if (
                order.packageConfirmed &&
                !order.validated
            ) {

                openValidateModal(order);

            }

        }
    );


    actions.appendChild(
        photosButton
    );

    actions.appendChild(
        packageButton
    );

    actions.appendChild(
        validateButton
    );


    card.appendChild(info);
    card.appendChild(actions);


    return card;
}


/* =========================================================
   CRIA BOTÃO DE ETAPA
   ========================================================= */

function createStepButton({
    type,
    icon,
    text,
    state
}) {

    const button =
        document.createElement("button");


    button.type = "button";


    button.className =
        `step-button ${state}`;


    button.dataset.type =
        type;


    button.innerHTML = `

        <span class="step-icon">
            ${icon}
        </span>

        <span>
            ${text}
        </span>

    `;


    if (
        state === "locked"
    ) {

        button.disabled = true;

    }


    return button;
}


/* =========================================================
   PESQUISA
   ========================================================= */

function handleSearch() {

    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    if (!search) {

        renderOrders();

        return;

    }


    const filtered =
        orders.filter(
            (order) => {

                return (
                    order.pv
                        .toLowerCase()
                        .includes(search)
                );

            }
        );


    renderOrders(filtered);
}


/* =========================================================
   MODAL DE FOTOS
   ========================================================= */

function openPhotoModal(order) {

    currentOrder = order;


    photoModalTitle.textContent =
        `Pedido ${order.pv}`;


    updatePhotoModal();


    photoModal.classList.remove(
        "hidden"
    );


    photoModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";
}


/* ATUALIZA MODAL */

function updatePhotoModal() {

    if (!currentOrder) {
        return;
    }


    const photos =
        currentOrder.photos;


    /* CONTADOR */

    photoCounter.textContent =
        `${photos} / 3`;


    /* PROGRESSO */

    const percentage =
        (photos / 3) * 100;


    photoProgressFill.style.width =
        `${percentage}%`;


    /* BOTÃO CAPTURA */

    if (photos >= 3) {

        cameraTitle.textContent =
            "3 FOTOS REGISTRADAS";

        cameraDescription.textContent =
            "As três fotos foram registradas. Agora confirme para continuar.";

        capturePhotoButton.disabled =
            true;

        capturePhotoButton.textContent =
            "✓ FOTOS COMPLETAS";

    }

    else {

        cameraTitle.textContent =
            `FOTOGRAFAR FOTO ${photos + 1}`;

        cameraDescription.textContent =
            "Clique no botão abaixo para registrar a próxima foto.";

        capturePhotoButton.disabled =
            false;

        capturePhotoButton.textContent =
            `📷 CAPTURAR FOTO ${photos + 1}`;

    }


    /* CONFIRMAR */

    confirmPhotosButton.disabled =
        photos < 3;


    /* SLOTS */

    updatePhotoSlots();
}


/* =========================================================
   ATUALIZA SLOTS DE FOTOS
   ========================================================= */

function updatePhotoSlots() {

    for (
        let i = 1;
        i <= 3;
        i++
    ) {

        const slot =
            document.getElementById(
                `photoSlot${i}`
            );


        if (
            i <= currentOrder.photos
        ) {

            slot.classList.add(
                "has-photo"
            );


            const placeholder =
                slot.querySelector(
                    ".slot-placeholder"
                );


            placeholder.textContent =
                "✓";

        }

        else {

            slot.classList.remove(
                "has-photo"
            );


            const placeholder =
                slot.querySelector(
                    ".slot-placeholder"
                );


            placeholder.textContent =
                "📷";

        }

    }
}


/* =========================================================
   SIMULA CAPTURA DA FOTO
   ========================================================= */

function capturePhoto() {

    if (!currentOrder) {
        return;
    }


    if (
        currentOrder.photos >= 3
    ) {

        return;

    }


    currentOrder.photos++;


    updatePhotoModal();


    showToast(
        `Foto ${currentOrder.photos} registrada!`,
        "✓"
    );


    /* Se completou as 3 fotos */

    if (
        currentOrder.photos === 3
    ) {

        cameraTitle.textContent =
            "FOTOS CONCLUÍDAS";

        cameraDescription.textContent =
            "As três fotos foram registradas com sucesso.";

    }
}


/* =========================================================
   CONFIRMA FOTOS
   ========================================================= */

function confirmPhotos() {

    if (!currentOrder) {
        return;
    }


    if (
        currentOrder.photos < 3
    ) {

        return;

    }


    const pv =
        currentOrder.pv;


    closePhotoModalWindow();


    renderOrders(
        getCurrentFilteredOrders()
    );


    showToast(
        `${pv}: fotos concluídas. Pacote liberado.`,
        "✓"
    );
}


/* =========================================================
   FECHA MODAL DE FOTOS
   ========================================================= */

function closePhotoModalWindow() {

    photoModal.classList.add(
        "hidden"
    );


    photoModal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.style.overflow =
        "";


    currentOrder = null;
}


/* =========================================================
   MODAL DE PACOTE
   ========================================================= */

function openPackageModal(order) {

    currentOrder = order;


    packageOrderNumber.textContent =
        order.pv;


    packageModal.classList.remove(
        "hidden"
    );


    packageModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";
}


/* FECHA */

function closePackageModal() {

    packageModal.classList.add(
        "hidden"
    );


    packageModal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.style.overflow =
        "";


    currentOrder = null;
}


/* CONFIRMA */

function confirmPackage() {

    if (!currentOrder) {
        return;
    }


    const pv =
        currentOrder.pv;


    currentOrder.packageConfirmed =
        true;


    closePackageModal();


    renderOrders(
        getCurrentFilteredOrders()
    );


    showToast(
        `${pv}: produto colocado em pacote.`,
        "✓"
    );
}


/* =========================================================
   MODAL DE VALIDAÇÃO
   ========================================================= */

function openValidateModal(order) {

    currentOrder = order;


    validateOrderNumber.textContent =
        order.pv;


    validateModal.classList.remove(
        "hidden"
    );


    validateModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";
}


/* FECHA */

function closeValidateModal() {

    validateModal.classList.add(
        "hidden"
    );


    validateModal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.style.overflow =
        "";


    currentOrder = null;
}


/* CONFIRMA VALIDAÇÃO */

function confirmValidation() {

    if (!currentOrder) {
        return;
    }


    const pv =
        currentOrder.pv;


    currentOrder.validated =
        true;


    closeValidateModal();


    renderOrders(
        getCurrentFilteredOrders()
    );


    showToast(
        `${pv}: processo concluído com sucesso!`,
        "✓"
    );
}


/* =========================================================
   FILTRO ATUAL
   ========================================================= */

function getCurrentFilteredOrders() {

    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    if (!search) {

        return orders;

    }


    return orders.filter(
        (order) => {

            return order.pv
                .toLowerCase()
                .includes(search);

        }
    );
}


/* =========================================================
   FECHA TODOS OS MODAIS
   ========================================================= */

function closeAllModals() {

    closePhotoModalWindow();

    closePackageModal();

    closeValidateModal();

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
    message,
    icon = "✓"
) {

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
            3000
        );
}