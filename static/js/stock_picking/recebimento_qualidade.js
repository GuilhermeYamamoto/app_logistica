/* =========================================================
   RECEBIMENTO QUALIDADE - V6
========================================================= */


let pickings = [];


/* =========================================================
   ESTADO DA INTERFACE
========================================================= */

let currentFilter = "pendentes";

let searchTerm = "";

let currentPickingId = null;

let currentPhotoIndex = null;

let toastTimeout = null;


/* =========================================================
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

            photos: [
                null,
                null,
                null
            ],

            packageConfirmed: false,

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
        "input",
        () => {

            searchTerm =
                searchInput.value
                    .trim()
                    .toLowerCase();

            clearSearch.style.display =
                searchTerm
                    ? "block"
                    : "none";

            render();

        }
    );


    clearSearch.addEventListener(
        "click",
        () => {

            searchInput.value = "";

            searchTerm = "";

            clearSearch.style.display =
                "none";

            render();

            searchInput.focus();

        }
    );

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
        &&
        picking.packageConfirmed
    ) {

        return {
            label: "PRONTO PARA VALIDAR",
            className: "status-ready"
        };

    }


    if (
        picking.photos.every(
            photo => photo !== null
        )
    ) {

        return {
            label: "AGUARDANDO PACOTE",
            className: "status-package"
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
                (
                    picking.photos.some(
                        photo => photo !== null
                    )
                    ||
                    picking.packageConfirmed
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
                !searchTerm
                ||
                picking.pv
                    .toLowerCase()
                    .includes(searchTerm);

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
                (
                    picking.photos.some(
                        photo => photo !== null
                    )
                    ||
                    picking.packageConfirmed
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


    const photosComplete =
        picking.photos.every(
            photo => photo !== null
        );


    const packageAvailable =
        photosComplete;


    const validationAvailable =
        photosComplete
        &&
        picking.packageConfirmed;


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
                class="main-action photo-action"
                data-action="photos"
                data-picking-id="${picking.id}"
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
                    picking.receivedQuantity;

                return;

            }


            picking.receivedQuantity =
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


        case "package":

            openPackageModal(picking);

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

                const picking =
                    findPicking(
                        currentPickingId
                    );


                if (!picking) return;


                if (
                    picking.photos.every(
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


    const picking =
        findPicking(currentPickingId);


    if (!picking) {

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

        picking.photos[
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

function openPhotoModal(picking) {

    currentPickingId =
        picking.id;


    document.getElementById(
        "photoPickingInfo"
    ).textContent =
        `${picking.pv} • ${picking.product}`;


    updatePhotoInterface();

    openModal(
        "photoModal"
    );

}


/* =========================================================
   ATUALIZAR FOTOS
========================================================= */

function updatePhotoInterface() {

    const picking =
        findPicking(currentPickingId);


    if (!picking) return;


    const completed =
        picking.photos.filter(
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
                    picking.photos[index];


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


    const photosComplete =
        picking.photos.every(
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
        reprovacao === "partial"
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
        reprovacao,
        quantidade_nao_conforme:
            reprovacao === "partial"
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

        picking.qualityAlert = quality_alert_data;

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
