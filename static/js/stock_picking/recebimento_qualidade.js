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

const photoInput =
    document.getElementById("photoInput");

const qualityRecordsElement =
    document.getElementById("qualityRecords");

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

    const addPhotoButton =
        document.getElementById(
            "addPhotoButton"
        );

    if (!addPhotoButton) {
        return;
    }

    addPhotoButton.addEventListener(
        "click",
        () => {

            if (photosSaving) {
                return;
            }

            currentPhotoIndex =
                photoSession.length;

            photoInput.value = "";

            photoInput.click();

        }
    );


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

    photoInput.addEventListener(
        "change",
        handlePhotoSelection
    );

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
            "button"
        );

    addPhotoButton.type =
        "button";

    addPhotoButton.id =
        "addPhotoButton";

    addPhotoButton.className =
        "add-photo-button";


    addPhotoButton.innerHTML = `
        <div class="camera-icon">
            📷
        </div>

        <span>
            ADICIONAR FOTO
        </span>
    `;


    addPhotoButton.addEventListener(
        "click",
        () => {

            if (photosSaving) {
                return;
            }

            currentPhotoIndex =
                photoSession.length;

            photoInput.value = "";

            photoInput.click();

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


    const finishButton =
        document.getElementById(
            "finishPhotosButton"
        );


    photosSaving = true;


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

        picking.validated = true;


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
}


/* =========================================================
   IMPRESSÃO
========================================================= */

async function printLabel(picking) {
    try {
        const response = await fetch(
            `/api/recebimento-qualidade/${picking.id}/imprimir-etiqueta`,
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
