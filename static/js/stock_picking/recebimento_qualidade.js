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

let toastTimeout = null;

let qualityCauses = [];

let selectedQualityCauses = [];

let actionInProgress = false;



/*=========================================================
   ELEMENTOS
========================================================= */

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

const loadingOverlay =
    document.getElementById("loadingOverlay");

const themeToggle =
    document.getElementById("themeToggle");



/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupTheme();

    setupDashboard();

    setupSearch();

    setupModalButtons();

    setupPhotoSlots();

    setupPhotoInput();

    setupQualityForm();

    setupQuantityValidation();

    setupQualityCauses();

    loadPickings();

});


/* =========================================================
   TEMA
========================================================= */

function setupTheme() {

    if (!themeToggle) {
        return;
    }

    const savedTheme =
        localStorage.getItem("recebimentoQualidadeTheme");

    const prefersDark =
        window.matchMedia &&
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;

    const initialTheme =
        savedTheme ||
        (prefersDark ? "dark" : "light");

    applyTheme(initialTheme);

    themeToggle.addEventListener(
        "click",
        toggleTheme
    );
}

function applyTheme(theme) {

    const isDark =
        theme === "dark";

    document.documentElement.dataset.theme =
        isDark
            ? "dark"
            : "light";

    if (!themeToggle) {
        return;
    }

    themeToggle.textContent =
        isDark
            ? "☀️"
            : "🌙";

    themeToggle.setAttribute(
        "aria-label",
        isDark
            ? "Ativar modo claro"
            : "Ativar modo escuro"
    );

    themeToggle.setAttribute(
        "title",
        isDark
            ? "Ativar modo claro"
            : "Ativar modo escuro"
    );
}

function toggleTheme() {

    const currentTheme =
        document.documentElement.dataset.theme ||
        "light";

    const newTheme =
        currentTheme === "dark"
            ? "light"
            : "dark";

    applyTheme(newTheme);

    localStorage.setItem(
        "recebimentoQualidadeTheme",
        newTheme
    );
}


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

            photosRegistered:
                Boolean(picking.photosRegistered),

            photoCount:
                Number(picking.photoCount || 0),

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

    if (!loadingOverlay) {
        return;
    }

    loadingOverlay.classList.remove(
        "hidden"
    );

    loadingOverlay.setAttribute(
        "aria-hidden",
        "false"
    );

}


function hideLoading() {

    actionInProgress = false;

    if (!loadingOverlay) {
        return;
    }

    loadingOverlay.classList.add(
        "hidden"
    );

    loadingOverlay.setAttribute(
        "aria-hidden",
        "true"
    );

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
        picking.photos.some(
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
                picking.photos.some(
                    photo => photo !== null
                )
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
                picking.photos.some(
                    photo => photo !== null
                )
        ).length;



    const completed =
        pickings.filter(
            picking => picking.validated
        ).length;


    const totalElement =
        document.getElementById(
            "totalCount"
        );

    const pendingElement =
        document.getElementById(
            "pendingCount"
        );

    const progressElement =
        document.getElementById(
            "progressCount"
        );

    const completedElement =
        document.getElementById(
            "completedCount"
        );


    if (totalElement) {

        totalElement.textContent =
            formatCount(total);

    }


    if (pendingElement) {

        pendingElement.textContent =
            formatCount(pending);

    }


    if (progressElement) {

        progressElement.textContent =
            formatCount(progress);

    }


    if (completedElement) {

        completedElement.textContent =
            formatCount(completed);

    }

}


/* =========================================================
   TÍTULO DA SEÇÃO
========================================================= */

function renderSectionTitle() {

    const titles = {

        todos:
            "TODOS OS PEDIDOS",

        pendentes:
            "PEDIDOS PENDENTES",

        andamento:
            "PEDIDOS EM ANDAMENTO",

        concluidos:
            "PEDIDOS CONCLUÍDOS"

    };


    currentSection.textContent =
        titles[currentFilter] ||
        "PEDIDOS";

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
        picking.photosRegistered === true;



    article.innerHTML = `

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


        <div class="secondary-actions">

            <button
                class="secondary-action quality-action"
                data-action="quality"
                data-picking-id="${picking.id}"
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

function handleAction(
    action,
    picking_id
) {

    if (actionInProgress) {
        return;
    }

    const picking =
        findPicking(picking_id);


    if (!picking) return;


    currentPickingId =
        picking_id;


    switch (action) {

        case "photos":

            openPhotoModal(picking);

            break;


        case "validate":

            openValidationModal(picking);

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


    if (
        !grid ||
        !finishButton ||
        !progressText ||
        !progressBar ||
        !photoMessage
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
        option => {

            option.addEventListener(
                "change",
                () => {

                    const partialGroup =
                        document.getElementById(
                            "partialQuantityGroup"
                        );


                    if (
                        option.value === "parcial"
                        &&
                        option.checked
                    ) {

                        partialGroup.classList.remove(
                            "hidden"
                        );

                    } else if (
                        option.value === "total"
                        &&
                        option.checked
                    ) {

                        partialGroup.classList.add(
                            "hidden"
                        );

                    }

                }
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


/* =========================================================
   CAUSAS DA NÃO CONFORMIDADE
========================================================= */

function setupQualityCauses() {

    const selector =
        document.getElementById(
            "causas_nao_conformidade"
        );


    const dropdown =
        document.getElementById(
            "causesDropdown"
        );


    if (
        !selector ||
        !dropdown
    ) {
        return;
    }


    selector.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            toggleCausesDropdown();

        }
    );


    selector.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
                ||
                event.key === " "
            ) {

                event.preventDefault();

                toggleCausesDropdown();

            }


            if (
                event.key === "Escape"
            ) {

                closeCausesDropdown();

            }

        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                !selector.contains(event.target)
                &&
                !dropdown.contains(event.target)
            ) {

                closeCausesDropdown();

            }

        }
    );


    loadQualityCauses();

}


function toggleCausesDropdown() {

    const dropdown =
        document.getElementById(
            "causesDropdown"
        );


    const selector =
        document.getElementById(
            "causas_nao_conformidade"
        );


    if (
        !dropdown ||
        !selector
    ) {
        return;
    }


    const isHidden =
        dropdown.classList.contains(
            "hidden"
        );


    if (isHidden) {

        dropdown.classList.remove(
            "hidden"
        );

        selector.classList.add(
            "open"
        );

    } else {

        closeCausesDropdown();

    }

}


function closeCausesDropdown() {

    const dropdown =
        document.getElementById(
            "causesDropdown"
        );


    const selector =
        document.getElementById(
            "causas_nao_conformidade"
        );


    if (dropdown) {

        dropdown.classList.add(
            "hidden"
        );

    }


    if (selector) {

        selector.classList.remove(
            "open"
        );

    }

}


async function loadQualityCauses() {

    const causesList =
        document.getElementById(
            "causesList"
        );


    if (!causesList) {
        return;
    }


    causesList.innerHTML =
        `<div class="causes-loading">
            Carregando causas...
        </div>`;


    try {

        const response =
            await fetch(
                "/api/recebimento-qualidade/causas"
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.detail ||
                "Não foi possível carregar as causas."
            );

        }


        qualityCauses =
            Array.isArray(data)
                ? data
                : [];


        renderQualityCauses();


    } catch (error) {

        console.error(
            "Erro ao carregar causas:",
            error
        );


        qualityCauses = [];


        causesList.innerHTML =
            `<div class="causes-error">
                Não foi possível carregar as causas.
            </div>`;

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


    if (
        qualityCauses.length === 0
    ) {

        causesList.innerHTML =
            `<div class="causes-empty">
                Nenhuma causa encontrada.
            </div>`;

        return;

    }


    qualityCauses.forEach(
        cause => {

            const causeId =
                getCauseId(cause);


            const causeName =
                getCauseName(cause);


            const option =
                document.createElement(
                    "button"
                );


            option.type =
                "button";


            option.className =
                "cause-option";


            if (
                selectedQualityCauses.some(
                    selected =>
                        String(
                            getCauseId(selected)
                        )
                        ===
                        String(causeId)
                )
            ) {

                option.classList.add(
                    "selected"
                );

            }


            option.innerHTML = `

                <span class="cause-check">
                    ✓
                </span>

                <span class="cause-option-name">
                    ${escapeHtml(causeName)}
                </span>

            `;


            option.addEventListener(
                "click",
                () => {

                    toggleQualityCause(
                        cause
                    );

                }
            );


            causesList.appendChild(
                option
            );

        }
    );

}


function toggleQualityCause(cause) {

    const causeId =
        getCauseId(cause);


    const existingIndex =
        selectedQualityCauses.findIndex(
            selected =>
                String(
                    getCauseId(selected)
                )
                ===
                String(causeId)
        );


    if (existingIndex >= 0) {

        selectedQualityCauses.splice(
            existingIndex,
            1
        );

    } else {

        selectedQualityCauses.push(
            cause
        );

    }


    renderQualityCauses();

    renderSelectedQualityCauses();

}


function renderSelectedQualityCauses() {

    const selectedContainer =
        document.getElementById(
            "selectedCauses"
        );


    if (!selectedContainer) {
        return;
    }


    selectedContainer.innerHTML = "";


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


        selectedContainer.appendChild(
            placeholder
        );

        return;

    }


    selectedQualityCauses.forEach(
        cause => {

            const item =
                document.createElement(
                    "span"
                );


            item.className =
                "selected-cause";


            item.textContent =
                getCauseName(cause);


            selectedContainer.appendChild(
                item
            );

        }
    );

}


function resetQualityCauses() {

    selectedQualityCauses = [];

    renderSelectedQualityCauses();

    renderQualityCauses();

    closeCausesDropdown();

}


function getCauseId(cause) {

    if (
        cause === null
        ||
        cause === undefined
    ) {

        return null;

    }


    if (
        typeof cause !== "object"
    ) {

        return cause;

    }


    return (
        cause.id
        ??
        cause.value
        ??
        cause.code
        ??
        cause.name
    );

}


function getCauseName(cause) {

    if (
        cause === null
        ||
        cause === undefined
    ) {

        return "";

    }


    if (
        typeof cause !== "object"
    ) {

        return String(cause);

    }


    return String(
        cause.name
        ??
        cause.label
        ??
        cause.display_name
        ??
        cause.description
        ??
        cause.id
        ??
        ""
    );

}


/* =========================================================
   ENVIO DO ALERTA DE QUALIDADE
========================================================= */

async function submitQualityAlert(event) {

    event.preventDefault();


    if (actionInProgress) {
        return;
    }


    const picking =
        findPicking(currentPickingId);


    if (!picking) {
        return;
    }


    const rejection =
        document.querySelector(
            'input[name="reprovacao"]:checked'
        );


    const rejectionType =
        rejection
            ? rejection.value
            : "total";


    const partialQuantityInput =
        document.getElementById(
            "quantidade_nao_conforme"
        );


    let rejectedQuantity =
        null;


    if (
        rejectionType === "parcial"
    ) {

        rejectedQuantity =
            Number(
                partialQuantityInput.value
            );


        if (
            Number.isNaN(
                rejectedQuantity
            )
            ||
            rejectedQuantity <= 0
        ) {

            showToast(
                "Informe uma quantidade reprovada válida.",
                "!"
            );

            return;

        }

    }


    if (
        selectedQualityCauses.length === 0
    ) {

        showToast(
            "Selecione pelo menos uma causa da não conformidade.",
            "!"
        );

        return;

    }


    const description =
        document
            .getElementById(
                "descricao_geral"
            )
            .value
            .trim();


    const specified =
        document
            .getElementById(
                "especificado_quality"
            )
            .value
            .trim();


    const found =
        document
            .getElementById(
                "encontrado_quality"
            )
            .value
            .trim();


    const submitButton =
        document
            .querySelector(
                "#qualityForm .quality-button"
            );


    const originalText =
        submitButton.textContent;


    submitButton.disabled =
        true;


    submitButton.textContent =
        "REGISTRANDO...";


    showLoading();


    try {

        const response =
            await fetch(
                "/api/recebimento-qualidade/alerta",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        picking_id:
                            picking.id,

                        reprovacao:
                            rejectionType,

                        quantidade_nao_conforme:
                            rejectedQuantity,

                        causas:
                            selectedQualityCauses.map(
                                cause => ({
                                    id:
                                        getCauseId(
                                            cause
                                        ),

                                    name:
                                        getCauseName(
                                            cause
                                        )
                                })
                            ),

                        descricao_geral:
                            description,

                        especificado:
                            specified,

                        encontrado:
                            found
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
                "Não foi possível registrar o alerta de qualidade."
            );

        }


        picking.qualityAlert =
            {
                reprovacao:
                    rejectionType,

                quantidade:
                    rejectedQuantity,

                causas:
                    [...selectedQualityCauses],

                descricao:
                    description,

                especificado:
                    specified,

                encontrado:
                    found
            };


        closeModal(
            "qualityModal"
        );


        showToast(
            "ALERTA DE QUALIDADE REGISTRADO COM SUCESSO",
            "✓"
        );


    } catch (error) {

        console.error(
            "Erro ao registrar alerta:",
            error
        );


        showToast(
            error.message ||
            "Não foi possível registrar o alerta de qualidade.",
            "!"
        );


    } finally {

        hideLoading();

        submitButton.disabled =
            false;

        submitButton.textContent =
            originalText;

    }

}


/* =========================================================
   IMPRESSÃO
========================================================= */

function printLabel(picking) {

    if (!picking) {
        return;
    }


    if (actionInProgress) {
        return;
    }


    const printWindow =
        window.open(
            "",
            "_blank",
            "width=600,height=500"
        );


    if (!printWindow) {

        showToast(
            "Não foi possível abrir a janela de impressão.",
            "!"
        );

        return;

    }


    printWindow.document.write(`
        <!DOCTYPE html>

        <html lang="pt-BR">

        <head>

            <meta charset="UTF-8">

            <title>
                Etiqueta ${escapeHtml(picking.pv)}
            </title>

            <style>

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    padding: 25px;
                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;
                    color: #111;
                }

                .label {
                    width: 100%;
                    border: 2px solid #111;
                    padding: 25px;
                }

                h1 {
                    margin: 0 0 20px;
                    font-size: 28px;
                }

                .row {
                    margin-bottom: 12px;
                }

                .row strong {
                    display: inline-block;
                    min-width: 110px;
                }

            </style>

        </head>

        <body>

            <div class="label">

                <h1>
                    RECEBIMENTO
                </h1>

                <div class="row">

                    <strong>
                        PV:
                    </strong>

                    ${escapeHtml(picking.pv)}

                </div>

                <div class="row">

                    <strong>
                        Cliente:
                    </strong>

                    ${escapeHtml(picking.client)}

                </div>

                <div class="row">

                    <strong>
                        Produto:
                    </strong>

                    ${escapeHtml(picking.product)}

                </div>

                <div class="row">

                    <strong>
                        Quantidade:
                    </strong>

                    ${escapeHtml(
                        String(
                            picking.receivedQuantity
                        )
                    )}

                </div>

            </div>

        </body>

        </html>
    `);


    printWindow.document.close();


    printWindow.onload =
        () => {

            printWindow.focus();

            printWindow.print();

        };

}

/* =========================================================
   UTILITÁRIOS
========================================================= */

function escapeHtml(value) {

    if (
        value === null
        ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

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


    if (
        !toast
        ||
        !toastMessage
        ||
        !toastIcon
    ) {

        return;

    }


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