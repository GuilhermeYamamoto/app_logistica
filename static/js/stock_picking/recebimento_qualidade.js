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
    let inventoryLocations = [];
    let selectedLocationId = null;
    let locationsLoading = false;

    function normalizeRecord(record) {
        return {
            ...record,
            photos: [],
            photosRegistered: Boolean(record.photosRegistered),
            photoCount: Number(record.photoCount || 0),
            local: record.local || null,
            barcodeRegistered: Boolean(record.barcodeRegistered),
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
               
        const product = context.main.querySelector(".product-info");

        context.replacePrimaryActions([
            context.createAction({
                className: "main-action photo-action",
                label: picking.photosRegistered ? "FOTOS REGISTRADAS" : "FOTOS",
                icon: "📷",
                disabled: picking.photosRegistered,
                onClick: () => openPhotoModal(picking),
            }),
        ]);

        context.addSecondaryAction(
            context.createQualityAction(
                "secondary-action quality-action",
                !picking.photosRegistered,
            ),
        );

        context.addSecondaryAction(
            context.createAction({
                className: "secondary-action print-action",
                label: "IMPRIMIR ETIQUETA",
                icon: "🖨️",
                onClick: () => printLabel(picking),
            }),
        );

        context.addSecondaryAction(
            context.createAction({
                className: "main-action barcode-scanner-action",
                label: "LER CÓDIGO",
                icon: "▥",
                ariaLabel: "Ler código de barras",
                disabled: !picking.photosRegistered,
                onClick: () => openBarcodeScanner(picking.id),
            }),
        );

        context.addSecondaryAction(
            context.createValidationAction(
                "main-action validation-action",
                !picking.photosRegistered ||
                    !picking.local ||
                    picking.local === "CD/STO",
            ),
        );

        const secondaryInfoRow = document.createElement("div");
        secondaryInfoRow.className = "secondary-info-row";

        // LOCAL
        const localBox = document.createElement("div");
        localBox.className = "local-box";

        const localLabel = document.createElement("div");
        localLabel.className = "local-label";
        localLabel.textContent = "Local";

        const localValue = document.createElement("div");
        localValue.className = "local-value";
        localValue.textContent =
            picking.local && picking.local !== "CD/STO"
                ? picking.local
                : "Não definido";

        localBox.appendChild(localLabel);
        localBox.appendChild(localValue);

        // RESULT PACKAGE
        const resultPackageBox = document.createElement("div");
        resultPackageBox.className = "result-package-box";

        const resultPackageLabel = document.createElement("div");
        resultPackageLabel.className = "result-package-label";
        resultPackageLabel.textContent = "Embalagem";

        const resultPackageValue = document.createElement("div");
        resultPackageValue.className = "result-package-value";

        resultPackageValue.textContent =
            picking.resultPackageName ||
            "Não definido";

        resultPackageBox.appendChild(resultPackageLabel);
        resultPackageBox.appendChild(resultPackageValue);

        // Adiciona os dois na mesma linha
        secondaryInfoRow.appendChild(localBox);
        secondaryInfoRow.appendChild(resultPackageBox);

        // Adiciona a segunda linha ao card
        context.main.appendChild(secondaryInfoRow);
    }

    async function beforeValidate(picking) {
        const hasValidLocation =
            picking.local && picking.local !== "CD/STO";

        if (picking.photosRegistered && hasValidLocation) {
            return true;
        }

        window.AppUI.closeModal("validationModal");

        if (!picking.photosRegistered) {
            inventory.showToast(
                "É necessário registrar pelo menos 3 fotos antes de validar o pedido.",
                "!",
            );
            return false;
        }

        inventory.showToast(
            "É necessário ler o código ou selecionar o local antes de validar o pedido.",
            "!",
        );
        return false;
    }

    async function refreshRecords({ replaceRecords, showToast }) {
        const stageKey = document.body.dataset.stageKey;
        const response = await fetch(
            `/api/inventario/pickings/refresh/${encodeURIComponent(stageKey)}`,
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
        if (!window.AppUI?.initializeSearch) {
            console.error("A interface compartilhada de pesquisa não foi carregada.");
            return;
        }

        window.AppUI.initializeSearch({
            canInteract: () => !inventory.isActionInProgress(),

            onSearch: (term) => {
                if (!term) {
                    filteredPickingIds = null;
                    inventory.render();
                    return;
                }

                filterByNF(term);
            },

            onClear: () => {
                filteredPickingIds = null;
                inventory.render();
            },
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
                    `/api/inventario/pickings?nf_number=${encodeURIComponent(nfNumber)}`,
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
                const response = await fetch("/api/inventario/pickings/photos", {
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
        if (
            !document.getElementById("barcodeScannerVideo") ||
            !document.getElementById("barcodeScannerStatus")
        ) {
            return;
        }

        window.addEventListener("pagehide", () => {
            stopBarcodeScanner(true);
        });

        document.addEventListener("app:modal-close", (event) => {
            if (event.detail?.id === "barcodeScannerModal") {
                stopBarcodeScanner(true);
                resetLocationSelection();
                showBarcodeScannerView();
            }
        });

        document
            .getElementById("chooseLocationButton")
            ?.addEventListener("click", openLocationSelection);

        document
            .getElementById("backToBarcodeButton")
            ?.addEventListener("click", backToBarcodeScanner);

        document
            .getElementById("confirmLocationButton")
            ?.addEventListener("click", confirmLocationSelection);

        document
            .getElementById("locationSearchInput")
            ?.addEventListener("input", filterLocationList);
    }

    async function openLocationSelection() {
        if (!barcodeScannerPickingId || inventory.isActionInProgress()) {
            return;
        }

        // Para a câmera, mas mantém o pickingId
        stopBarcodeScanner(false);

        selectedLocationId = null;

        const confirmButton = document.getElementById("confirmLocationButton");

        if (confirmButton) {
            confirmButton.disabled = true;
        }

        showLocationSelectionView();

        await loadInventoryLocations();
    }

    function showBarcodeScannerView() {
        const scannerView = document.getElementById("barcodeScannerView");
        const locationView = document.getElementById("locationSelectionView");

        scannerView?.classList.remove("hidden");
        locationView?.classList.add("hidden");

        const searchInput = document.getElementById("locationSearchInput");

        if (searchInput) {
            searchInput.value = "";
        }

        resetLocationSelection();
    }

    function showLocationSelectionView() {
        const scannerView = document.getElementById("barcodeScannerView");
        const locationView = document.getElementById("locationSelectionView");

        scannerView?.classList.add("hidden");
        locationView?.classList.remove("hidden");
    }

    function backToBarcodeScanner() {
        showBarcodeScannerView();

        const pickingId = barcodeScannerPickingId;

        if (pickingId) {
            openBarcodeScanner(pickingId);
        }
    }

    async function loadInventoryLocations() {
        const list = document.getElementById("locationList");
        const status = document.getElementById("locationSelectionStatus");

        if (!list || locationsLoading) {
            return;
        }

        locationsLoading = true;

        list.innerHTML = `
            <div class="location-list-message">
                CARREGANDO LOCAIS...
            </div>
        `;

        if (status) {
            status.textContent = "";
        }   

        try {
            const response = await fetch(
                `/api/inventario/pickings/${barcodeScannerPickingId}/location`,
                {
                    headers: {
                        Accept: "application/json",
                    },
                    cache: "no-store",
                },
            );

            const data = await response.json().catch(() => null);

            if (!response.ok || !Array.isArray(data)) {
                throw new Error(
                    data?.detail ||
                    "Não foi possível carregar os locais.",
                );
            }

            inventoryLocations = data;

            renderLocationList(inventoryLocations);

        } catch (error) {
            console.error("Erro ao carregar locais:", error);

            list.innerHTML = `
                <div class="location-list-message">
                    ${error.message || "Não foi possível carregar os locais."}
                </div>
            `;

            inventory.showToast(
                error.message ||
                "Não foi possível carregar os locais.",
                "!",
            );

        } finally {
            locationsLoading = false;
        }
    }

    function renderLocationList(locations) {
        const list = document.getElementById("locationList");

        if (!list) {
            return;
        }

        if (!locations.length) {
            list.innerHTML = `
                <div class="location-list-message">
                    NENHUM LOCAL ENCONTRADO.
                </div>
            `;
            return;
        }

        list.replaceChildren(
            ...locations.map((location) => {
                const button = document.createElement("button");

                button.type = "button";
                button.className = "location-option";

                if (
                    Number(location.id) ===
                    Number(selectedLocationId)
                ) {
                    button.classList.add("selected");
                }

                const name = document.createElement("span");
                name.className = "location-option-name";
                name.textContent = location.name;

                const check = document.createElement("span");
                check.className = "location-option-check";
                check.textContent = "✓";

                button.append(name, check);

                button.addEventListener("click", () => {
                    selectLocation(location);
                });

                return button;
            }),
        );
    }

    function selectLocation(location) {
        selectedLocationId = Number(location.id);

        const searchInput = document.getElementById(
            "locationSearchInput",
        );

        const term = searchInput?.value?.trim().toLowerCase() || "";

        renderLocationList(
            getFilteredLocations(term),
        );

        const confirmButton = document.getElementById(
            "confirmLocationButton",
        );

        if (confirmButton) {
            confirmButton.disabled = false;
        }

        const status = document.getElementById(
            "locationSelectionStatus",
        );

        if (status) {
            status.textContent =
                `LOCAL SELECIONADO: ${location.name}`;
        }
    }

    function filterLocationList(event) {
        const term = event.target.value.trim().toLowerCase();

        renderLocationList(
            getFilteredLocations(term),
        );
    }

    function getFilteredLocations(term) {
        if (!term) {
            return inventoryLocations;
        }

        return inventoryLocations.filter((location) =>
            String(location.name || "")
                .toLowerCase()
                .includes(term),
        );
    }

    async function confirmLocationSelection() {
        const pickingId = barcodeScannerPickingId;
        const confirmButton = document.getElementById(
            "confirmLocationButton",
        );

        if (
            !pickingId ||
            !selectedLocationId ||
            inventory.isActionInProgress()
        ) {
            return;
        }

        const location = inventoryLocations.find(
            (item) =>
                Number(item.id) ===
                Number(selectedLocationId),
        );

        if (!location) {
            inventory.showToast(
                "O local selecionado não foi encontrado.",
                "!",
            );
            return;
        }

        const originalText =
            confirmButton?.textContent || "CONFIRMAR";

        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.textContent = "SALVANDO...";
        }

        try {
            await inventory.runAction(async () => {
                const response = await fetch(
                    `/api/inventario/pickings/${pickingId}/location`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            location_id: selectedLocationId,
                        }),
                    },
                );

                const data = await response.json().catch(
                    () => ({}),
                );

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Não foi possível definir o local.",
                    );
                }

                const picking =
                    inventory.getRecord(pickingId);

                if (picking) {
                    picking.local =
                        data.local || location.name;

                    picking.barcodeRegistered = Boolean(
                        picking.local,
                    );
                }

                window.AppUI.closeModal(
                    "barcodeScannerModal",
                );

                inventory.render();

                inventory.showToast(
                    `LOCAL DEFINIDO: ${
                        data.local || location.name
                    }`,
                );
            });

        } catch (error) {
            console.error(
                "Erro ao definir local manualmente:",
                error,
            );

            inventory.showToast(
                error.message ||
                "Não foi possível definir o local.",
                "!",
            );

        } finally {
            if (confirmButton) {
                confirmButton.disabled =
                    !selectedLocationId;

                confirmButton.textContent =
                    originalText;
            }
        }
    }

    function resetLocationSelection() {
        selectedLocationId = null;

        const confirmButton = document.getElementById(
            "confirmLocationButton",
        );

        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.textContent = "CONFIRMAR";
        }

        const status = document.getElementById(
            "locationSelectionStatus",
        );

        if (status) {
            status.textContent = "";
        }

        const list = document.getElementById(
            "locationList",
        );

        if (
            list &&
            inventoryLocations.length
        ) {
            renderLocationList(
                inventoryLocations,
            );
        }
    }

    async function openBarcodeScanner(pickingId) {
        if (barcodeScannerActive || !inventory.getRecord(pickingId)) {
            return;
        }

        barcodeScannerPickingId = pickingId;
        selectedLocationId = null;
        showBarcodeScannerView();

        const video = document.getElementById("barcodeScannerVideo");
        const status = document.getElementById("barcodeScannerStatus");
        if (!video || !status) {
            return;
        }

        window.AppUI.openModal("barcodeScannerModal");
        status.textContent = "Solicitando acesso à câmera...";
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
                `/api/inventario/pickings/${pickingId}/barcode`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ barcode }),
                },
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.detail || "Não foi possível enviar o código lido."
                );
            }

            const picking = inventory.getRecord(pickingId);

            if (picking) {
                picking.local = data.local || null;
                picking.barcodeRegistered = Boolean(data.local);
            }

            window.AppUI.closeModal("barcodeScannerModal");

            inventory.render();

            inventory.showToast(
                `LOCAL DEFINIDO: ${data.local || "Não definido"}`
            );

        } catch (error) {
            console.error("Erro ao enviar código de barras:", error);

            status.textContent =
                error.message ||
                "Não foi possível enviar o código. Tente novamente.";

            barcodeScannerActive = true;
        }
    }

    function stopBarcodeScanner(clearPicking = false) {
        barcodeScannerActive = false;

        barcodeScanner?.stop();
        barcodeScanner = null;

        if (clearPicking) {
            barcodeScannerPickingId = null;
        }
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
                    `/api/inventario/${picking.id}/imprimir-etiqueta`,
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
        canEditQuantity: true, // Permite editar o campo de quantidade no cartão do pedido
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
        refreshRecords,
        resultText: (count) => `${count} ${count === 1 ? "pedido" : "pedidos"}`,
        validationSuccessMessage: () => "PEDIDO VALIDADO COM SUCESSO",
        validationText: (picking) => `Deseja realmente validar o pedido ${picking.pv}?`,
    });
}());
