(function () {
    "use strict";

    const inventory = window.AppInventory;
    if (!inventory) {
        console.error("O controlador compartilhado do inventário não foi carregado.");
        return;
    }

    const photoInstructions = [
        "Tirar foto da EMBALAGEM",
        "Tirar foto do PRODUTO",
        "Tirar foto da AMOSTRAGEM",
    ];

    let filteredPickingIds = null;
    let currentPhotoPickingId = null;
    let currentPhotoIndex = null;
    let photoSession = [];
    let photosSaving = false;
    let barcodeScanner = null;
    let barcodeScannerActive = false;
    let barcodeScannerPickingId = null;

    function normalizeRecord(record) {
        return {
            ...record,
            photos: [],
            photosRegistered: Boolean(record.photosRegistered),
            photoCount: Number(record.photoCount || 0),
        };
    }

    function getPickingStatus(picking) {
        if (picking.validated) {
            return { label: "CONCLUÍDO", className: "status-completed" };
        }
        if (picking.photos?.length >= 3 && picking.photos.every((photo) => photo !== null)) {
            return { label: "PRONTO PARA VALIDAR", className: "status-ready" };
        }
        if (picking.photos?.length || picking.photosRegistered) {
            return { label: "FOTOS CONCLUÍDAS", className: "status-photos" };
        }
        return { label: "AGUARDANDO FOTOS", className: "status-waiting" };
    }

    function enhanceCard(card, picking, context) {
        const quantityBox = document.createElement("div");
        quantityBox.className = "quantity-box";
        const quantityLabel = document.createElement("label");
        quantityLabel.textContent = "QUANTIDADE RECEBIDA";
        const quantityInput = document.createElement("input");
        quantityInput.className = "quantity-input";
        quantityInput.type = "number";
        quantityInput.min = "0";
        quantityInput.value = picking.receivedQuantity;
        quantityInput.addEventListener("change", () => updateReceivedQuantity(picking, quantityInput));
        const expectedQuantity = document.createElement("span");
        expectedQuantity.className = "expected-quantity";
        expectedQuantity.textContent = `Esperado: ${picking.expectedQuantity} unidades`;
        quantityBox.append(quantityLabel, quantityInput, expectedQuantity);

        const product = context.main.querySelector(".product-info");
        context.main.insertBefore(quantityBox, product);

        context.replacePrimaryActions([
            context.createAction({
                className: "main-action photo-action",
                label: picking.photosRegistered ? "FOTOS REGISTRADAS" : "FOTOS",
                icon: "📷",
                disabled: picking.photosRegistered,
                onClick: () => openPhotoModal(picking),
            }),
            context.createValidationAction(
                "main-action validation-action",
                !picking.photosRegistered,
            ),
            context.createAction({
                className: "main-action barcode-scanner-action",
                label: "LER CÓDIGO",
                icon: "▥",
                ariaLabel: "Ler código de barras",
                onClick: () => openBarcodeScanner(picking.id),
            }),
        ]);
        context.addSecondaryAction(
            context.createQualityAction("secondary-action quality-action"),
        );
        context.addSecondaryAction(context.createAction({
            className: "secondary-action print-action",
            label: "IMPRIMIR ETIQUETA",
            icon: "🖨️",
            onClick: () => printLabel(picking),
        }));
    }

    function showQuantityWarning(picking) {
        const warning = document.getElementById("quantityWarning");
        warning?.classList.toggle(
            "hidden",
            !(Number(picking.receivedQuantity) < Number(picking.expectedQuantity)),
        );
    }

    async function beforeValidate(picking) {
        if (picking.photosRegistered) {
            return true;
        }
        window.AppUI.closeModal("validationModal");
        inventory.showToast(
            "É necessário registrar pelo menos 3 fotos antes de validar o pedido.",
            "!",
        );
        return false;
    }

    async function refreshRecords({ replaceRecords, showToast }) {
        const stageKey = document.body.dataset.stageKey;
        const response = await fetch(
            `/api/recebimento-qualidade/pickings/refresh/${encodeURIComponent(stageKey)}`,
            {
                headers: { Accept: "application/json" },
                cache: "no-store",
            },
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(data?.records)) {
            throw new Error(data?.detail || "Não foi possível atualizar os recebimentos.");
        }
        replaceRecords(data.records);
        showToast("RECEBIMENTOS ATUALIZADOS");
    }

    function initializeQualityFeatures() {
        setupSearch();
        setupPhotoControls();
        setupBarcodeScanner();
    }

    function setupSearch() {
        const searchInput = document.getElementById("searchInput");
        const searchButton = document.getElementById("searchButton");
        const clearSearch = document.getElementById("clearSearch");
        if (!searchInput || !clearSearch) {
            return;
        }

        const search = () => {
            const term = searchInput.value.trim();
            if (!term) {
                filteredPickingIds = null;
                clearSearch.style.display = "none";
                inventory.render();
                return;
            }
            filterByNF(term);
        };

        searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                search();
            }
        });
        searchButton?.addEventListener("click", search);
        clearSearch.addEventListener("click", () => {
            if (inventory.isActionInProgress()) {
                return;
            }
            searchInput.value = "";
            filteredPickingIds = null;
            clearSearch.style.display = "none";
            inventory.render();
            searchInput.focus();
        });
    }

    async function filterByNF(nfNumber) {
        if (inventory.isActionInProgress()) {
            return;
        }
        const clearSearch = document.getElementById("clearSearch");
        try {
            await inventory.runAction(async () => {
                clearSearch?.style.setProperty("display", "block");
                const response = await fetch(
                    `/api/recebimento-qualidade/pickings?nf_number=${encodeURIComponent(nfNumber)}`,
                );
                const data = await response.json().catch(() => null);
                if (!response.ok || !Array.isArray(data)) {
                    throw new Error(data?.detail || "Não foi possível consultar a nota fiscal.");
                }
                filteredPickingIds = data.map((picking) => picking.id);
                inventory.render();
            });
        } catch (error) {
            console.error("Erro ao filtrar por NF:", error);
            filteredPickingIds = [];
            inventory.render();
            inventory.showToast(error.message || "Não foi possível consultar a nota fiscal.", "!");
        }
    }

    async function updateReceivedQuantity(picking, input) {
        const value = Number(input.value);
        if (inventory.isActionInProgress()) {
            input.value = picking.receivedQuantity;
            return;
        }
        if (Number.isNaN(value) || value < 0) {
            input.value = picking.receivedQuantity;
            return;
        }

        const previousValue = picking.receivedQuantity;
        picking.receivedQuantity = value;
        try {
            await inventory.runAction(async () => {
                const response = await fetch("/api/received_quantity", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        picking_id: picking.id,
                        received_quantity: value,
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.detail || "Erro ao atualizar quantidade.");
                }
                inventory.showToast("Quantidade atualizada.");
            });
        } catch (error) {
            console.error("Erro ao atualizar quantidade:", error);
            picking.receivedQuantity = previousValue;
            inventory.showToast(error.message || "Erro ao atualizar quantidade.", "!");
        } finally {
            inventory.render();
        }
    }

    function setupPhotoControls() {
        document.getElementById("finishPhotosButton")?.addEventListener("click", savePhotos);
        document.getElementById("photoCameraInput")?.addEventListener("change", handlePhotoSelection);
    }

    function openPhotoModal(picking) {
        if (picking.photosRegistered || inventory.isActionInProgress()) {
            return;
        }
        currentPhotoPickingId = picking.id;
        currentPhotoIndex = null;
        photoSession = [];
        photosSaving = false;
        const info = document.getElementById("photoPickingInfo");
        if (info) {
            info.textContent = `${picking.pv} • ${picking.product}`;
        }
        updatePhotoInterface();
        window.AppUI.openModal("photoModal");
    }

    function preparePhotoSelection(input) {
        if (photosSaving) {
            return false;
        }
        currentPhotoIndex = photoSession.length;
        input.value = "";
        return true;
    }

    function handlePhotoSelection(event) {
        const file = event.target.files[0];
        if (!file || currentPhotoIndex === null) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            inventory.showToast("Selecione uma imagem válida.", "!");
            return;
        }

        const reader = new FileReader();
        reader.addEventListener("load", () => {
            photoSession.push(reader.result);
            currentPhotoIndex = null;
            updatePhotoInterface();
            inventory.showToast(`FOTO ${photoSession.length} ADICIONADA`);
        });
        reader.addEventListener("error", () => inventory.showToast("Não foi possível carregar a foto.", "!"));
        reader.readAsDataURL(file);
    }

    function updatePhotoInterface() {
        const grid = document.getElementById("photoGrid");
        const finishButton = document.getElementById("finishPhotosButton");
        const progressText = document.getElementById("photoProgressText");
        const progressBar = document.getElementById("photoProgressBar");
        const photoMessage = document.getElementById("photoMessage");
        const photoInstruction = document.getElementById("photoInstruction");
        const cameraInput = document.getElementById("photoCameraInput");
        if (!grid || !finishButton || !progressText || !progressBar || !photoMessage || !photoInstruction || !cameraInput) {
            return;
        }

        grid.replaceChildren(...photoSession.map((photo, index) => {
            const slot = document.createElement("div");
            slot.className = "photo-slot";
            const preview = document.createElement("img");
            preview.className = "photo-preview";
            preview.src = photo;
            preview.alt = `Foto ${index + 1}`;
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "remove-photo-button";
            removeButton.textContent = "×";
            removeButton.title = "Excluir foto";
            removeButton.addEventListener("click", () => removePhoto(index));
            slot.append(preview, removeButton);
            return slot;
        }));

        const addPhotoButton = document.createElement("label");
        addPhotoButton.className = "add-photo-button";
        addPhotoButton.htmlFor = "photoCameraInput";
        const icon = document.createElement("div");
        icon.className = "camera-icon";
        icon.textContent = "📷";
        addPhotoButton.append(icon, document.createTextNode("TIRAR FOTO"));
        addPhotoButton.addEventListener("click", (event) => {
            if (!preparePhotoSelection(cameraInput)) {
                event.preventDefault();
            }
        });
        grid.append(addPhotoButton);

        const count = photoSession.length;
        progressText.textContent = `${count} FOTOS`;
        photoInstruction.textContent = photoInstructions[count] || "Tirar fotos adicionais, se necessário";
        progressBar.style.width = `${Math.min((count / 3) * 100, 100)}%`;
        finishButton.disabled = count < 3 || photosSaving;
        photoMessage.textContent = count < 3
            ? `Faltam ${3 - count} foto(s). É necessário registrar pelo menos 3 fotos.`
            : `✓ ${count} fotos adicionadas. Você pode registrar as fotos.`;
    }

    function removePhoto(index) {
        if (photosSaving || index < 0 || index >= photoSession.length) {
            return;
        }
        photoSession.splice(index, 1);
        updatePhotoInterface();
        inventory.showToast("FOTO REMOVIDA");
    }

    async function savePhotos() {
        const picking = inventory.getRecord(currentPhotoPickingId);
        const finishButton = document.getElementById("finishPhotosButton");
        if (!picking || photosSaving || inventory.isActionInProgress()) {
            return;
        }
        if (photoSession.length < 3) {
            inventory.showToast("É necessário registrar pelo menos 3 fotos.", "!");
            return;
        }

        photosSaving = true;
        const originalText = finishButton?.textContent;
        if (finishButton) {
            finishButton.disabled = true;
            finishButton.textContent = "REGISTRANDO...";
        }
        try {
            await inventory.runAction(async () => {
                const response = await fetch("/api/recebimento-qualidade/pickings/photos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        picking_id: picking.id,
                        photos: photoSession,
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.detail || "Não foi possível registrar as fotos.");
                }
                picking.photosRegistered = true;
                picking.photoCount = photoSession.length;
                window.AppUI.closeModal("photoModal");
                photoSession = [];
                currentPhotoIndex = null;
                inventory.render();
                inventory.showToast(`${picking.photoCount} FOTOS REGISTRADAS COM SUCESSO`);
            });
        } catch (error) {
            console.error("Erro ao registrar fotos:", error);
            inventory.showToast(error.message || "Não foi possível registrar as fotos.", "!");
        } finally {
            photosSaving = false;
            if (finishButton) {
                finishButton.disabled = photoSession.length < 3;
                finishButton.textContent = originalText;
            }
        }
    }

    function setupBarcodeScanner() {
        if (!document.getElementById("barcodeScannerVideo") || !document.getElementById("barcodeScannerStatus")) {
            return;
        }
        window.addEventListener("pagehide", stopBarcodeScanner);
        document.addEventListener("app:modal-close", (event) => {
            if (event.detail?.id === "barcodeScannerModal") {
                stopBarcodeScanner();
            }
        });
    }

    async function openBarcodeScanner(pickingId) {
        if (barcodeScannerActive || !inventory.getRecord(pickingId)) {
            return;
        }
        const video = document.getElementById("barcodeScannerVideo");
        const status = document.getElementById("barcodeScannerStatus");
        if (!video || !status) {
            return;
        }

        window.AppUI.openModal("barcodeScannerModal");
        status.textContent = "Solicitando acesso à câmera...";
        barcodeScannerPickingId = pickingId;
        barcodeScannerActive = true;
        const scanner = window.AppUI.createBarcodeScanner({
            video,
            onResult: handleBarcodeScanResult,
            onError: (error) => {
                status.textContent = getBarcodeScannerErrorMessage(error);
            },
        });
        barcodeScanner = scanner;
        try {
            await scanner.start();
            if (!barcodeScannerActive || barcodeScanner !== scanner) {
                scanner.stop();
            }
        } catch (error) {
            if (barcodeScanner === scanner) {
                barcodeScannerActive = false;
                barcodeScanner = null;
                status.textContent = getBarcodeScannerErrorMessage(error);
                console.error("Erro ao iniciar o leitor de código de barras:", error);
            }
        }
    }

    async function handleBarcodeScanResult(result) {
        if (!barcodeScannerActive || !result) {
            return;
        }
        const barcode = result.getText?.().trim();
        if (!barcode) {
            return;
        }
        const pickingId = barcodeScannerPickingId;
        const status = document.getElementById("barcodeScannerStatus");
        if (!pickingId || !status) {
            return;
        }

        barcodeScannerActive = false;
        status.textContent = "Enviando código lido...";
        try {
            const response = await fetch(
                `/api/recebimento-qualidade/pickings/${pickingId}/barcode`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ barcode }),
                },
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.detail || "Não foi possível enviar o código lido.");
            }
            window.AppUI.closeModal("barcodeScannerModal");
            inventory.showToast(`CÓDIGO ENVIADO: ${barcode}`);
        } catch (error) {
            console.error("Erro ao enviar código de barras:", error);
            status.textContent = error.message || "Não foi possível enviar o código. Tente novamente.";
            barcodeScannerActive = true;
        }
    }

    function stopBarcodeScanner() {
        barcodeScannerActive = false;
        barcodeScanner?.stop();
        barcodeScanner = null;
        barcodeScannerPickingId = null;
    }

    function getBarcodeScannerErrorMessage(error) {
        if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
            return "Permita o acesso à câmera para realizar a leitura.";
        }
        if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") {
            return "Nenhuma câmera compatível foi encontrada.";
        }
        return "Não foi possível iniciar a câmera. Tente novamente.";
    }

    async function printLabel(picking) {
        if (inventory.isActionInProgress()) {
            return;
        }
        try {
            await inventory.runAction(async () => {
                const response = await fetch(
                    `/api/recebimento-qualidade/${picking.id}/imprimir-etiqueta`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                    },
                );
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.detail || "Não foi possível imprimir a etiqueta.");
                }
                if (!data.iot_url || !data.payload) {
                    throw new Error("Resposta inválida do servidor para impressão.");
                }

                const iotResponse = await fetch(data.iot_url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data.payload),
                });
                if (!iotResponse.ok) {
                    const body = await iotResponse.json().catch(() => iotResponse.statusText);
                    throw new Error(`Erro IoT: ${iotResponse.status} - ${JSON.stringify(body)}`);
                }
                inventory.showToast(`ETIQUETA DO ${picking.pv} ENVIADA PARA IMPRESSÃO`);
            });
        } catch (error) {
            console.error("Erro ao imprimir etiqueta:", error);
            inventory.showToast(error.message || "Não foi possível imprimir a etiqueta.", "!");
        }
    }

    inventory.configure({
        beforeValidate,
        enhanceCard,
        getSectionTitle: (filter) => filter === "andamento"
            ? "PEDIDOS EM ANDAMENTO"
            : "PEDIDOS PENDENTES",
        getStatus: getPickingStatus,
        isInProgress: (picking) => !picking.validated && picking.photosRegistered,
        matchesRecord: (picking) => (
            filteredPickingIds === null || filteredPickingIds.includes(picking.id)
        ),
        normalizeRecord,
        onInitialized: initializeQualityFeatures,
        onOpenValidation: showQuantityWarning,
        refreshRecords,
        resultText: (count) => `${count} ${count === 1 ? "pedido" : "pedidos"}`,
        validationSuccessMessage: () => "PEDIDO VALIDADO COM SUCESSO",
        validationText: (picking) => `Deseja realmente validar o pedido ${picking.pv}?`,
    });
}());
