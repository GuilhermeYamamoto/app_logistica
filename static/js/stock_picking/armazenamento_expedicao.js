(function () {
    "use strict";

    const inventory = window.AppInventory;

    let barcodeScanner = null;
    let barcodeScannerActive = false;
    let barcodeScannerPickingId = null;

    let inventoryLocations = [];
    let selectedLocationId = null;
    let locationsLoading = false;

    if (!inventory) {
        console.error("O controlador compartilhado do inventario não foi carregado");
        return;
    }

    function enhanceCard(card, picking, context) {
        context.replacePrimaryActions([]); // Remove the default primary actions
        const clientInfo = context.main.querySelector(".client-info");

        if (clientInfo) {
            const label = clientInfo.querySelector("strong");
            const value = clientInfo.querySelector("h3");
            const pedidoVenda = picking.pedido_venda_name || (picking.pedido_venda_id ? `PV ${picking.pedido_venda_id}` : "Pedido de venda não definido");
            const cliente = picking.cliente || "Cliente não definido";

            if (label) {
                label.textContent = "Pedido de venda / Cliente";
            }
            if (value) {
                value.textContent = `${pedidoVenda} / ${cliente}`;
            }
        }

        const hasValidLocation = picking.local && picking.local !== "CD/STO" && picking.local !== "CD/EXP";

        context.addSecondaryAction(
            context.createAction({
                className: "secondary-action barcode-scanner-action",
                label: "LER CÓDIGO",
                icon: "▥",
                ariaLabel: "Ler código de barras",
                onClick: () => openBarcodeScanner(picking.id),
            }),
        );

        context.addSecondaryAction(
            context.createAction({
                className: "main-action validation-action",
                label: "ENVIAR PARA CONFERÊNCIA",
                arialLabel: "ENVIAR PARA CONFERÊNCIA",
                icon: "✔",
                disabled: !hasValidLocation,
                onClick: () => enviarParaConferenciaExpedicao(picking.id)
            }),
        );

        addLocationInfo(context, picking);
    }

    function addLocationInfo(context, picking) {
        const secondaryInfoRow = document.createElement("div");
        secondaryInfoRow.className = "secondary-info-row";

        const localBox = document.createElement("div");
        localBox.className = "local-box";

        const localLabel = document.createElement("div");
        localLabel.className = "local-label";
        localLabel.textContent = "Local";

        const localValue = document.createElement("div");
        localValue.className = "local-value";
        localValue.textContent = picking.local && picking.local !== "CD/STO" ? picking.local : "Não definido";

        localBox.append(localLabel, localValue);

        secondaryInfoRow.appendChild(localBox);

        context.main.appendChild(secondaryInfoRow);
    }

    function setBarcodeScanner() {
        document.addEventListener("app:modal-close", (event) => {
            if (event.detail?.id !== "barcodeScannerModal") {
                return;
            }

            stopBarcodeScanner(true);
            resetLocationSelection();
            showBarcodeScannerView();

        });

        window.addEventListener("pagehide", () => {
            stopBarcodeScanner(true);
        });

        document.getElementById("chooseLocationButton")?.addEventListener("click", openLocationSelection);
        document.getElementById("backToBarcodeButton")?.addEventListener("click", backToBarcodeScanner);
        document.getElementById("confirmLocationButton")?.addEventListener("click", confirmLocationSelection);
        document.getElementById("locationSearchInput")?.addEventListener("input", filterLocationList);

    }

    async function openBarcodeScanner(pickingId) {
        if ( barcodeScannerActive || !inventory.getRecord(pickingId)) {
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
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ barcode }),
                },
            );

            const data = await response.json().catch(() => ({}));
            console.log("Resposta do envio do código de barras:", data);
            
            if (!response.ok) {
                throw new Error(data.detail || "Não foi possível enviar o código lido.");
            }

            const picking = inventory.getRecord(pickingId);

            if (picking) {
                picking.local = data.local || null;
                picking.barcodeRegistered = Boolean(data.local);
            }

            window.AppUI.closeModal("barcodeScannerModal");
            inventory.render();

            inventory.showToast(`LOCAL DEFINIDO: ${data.local || "Não definido"}`);
        } catch (error) {
            console.error("Erro ao enviar código de barras:", error);
            status.textContent =
                error.message ||
                "Não foi possível enviar o código. Tente novamente.";
            barcodeScannerActive = true;
        }
    }

    async function openLocationSelection() {
        if (!barcodeScannerPickingId || inventory.isActionInProgress())         {        
            return;
        }

        stopBarcodeScanner(false);

        selectedLocationId = null;

        const confirmButton = document.getElementById("confirmLocationButton");
        if (confirmButton) {
            confirmButton.disabled = true;
        }
        
        showLocationSelectionView();

        await loadInventoryLocations();
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
                Carregando Locais...
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
                throw new Error(data?.detail || "Não foi possível carregar os locais.");
            }

            inventoryLocations = data;

            renderLocationList(inventoryLocations);
        } catch (error) {
            console.error("Erro ao carregar os locais:", error);

            list.innerHTML = `
                <div class="location-list-message">
                    ${error.message || "Não foi possível carregar os locais."}
                </div>
            `;

            inventory.showToast(error.message || "Não foi possível carregar os locais.", "!");
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

        list.replaceChildren(...locations.map((location) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "location-option";

            if (Number(location.id) === Number(selectedLocationId)) {
                button.classList.add("selected");
            }

            const name = document.createElement("span");
            name.className = "location-option-name";
            name.textContent = location.name;

            const check = document.createElement("span");
            check.className = "location-option-check";
            check.textContent = "✔";

            button.append(name, check);

            button.addEventListener("click", () => {
                selectLocation(location);
            });
            
            return button;
        }));
    }

    function selectLocation(location) {
        selectedLocationId = Number(location.id);

        const searchInput = document.getElementById("locationSearchInput");
        const term = searchInput?.value?.trim().toLowerCase() || "";

        renderLocationList(getFilteredLocations(term));

        const confirmButton = document.getElementById("confirmLocationButton");

        if (confirmButton) {
            confirmButton.disabled = false;
        }

        const status = document.getElementById("locationSelectionStatus");

        if (status) {
            status.textContent = `LOCAL SELECIONADO: ${location.name}`;
        }
    }

    function filterLocationList(event) {
        const term = event.target.value.trim().toLowerCase();

        renderLocationList(getFilteredLocations(term));
    }

    function getFilteredLocations(term) {
        if (!term) {
            return inventoryLocations;
        }
        return inventoryLocations.filter((location) => String(location.name || "").toLowerCase().includes(term));
    }

    async function confirmLocationSelection() {
        const pickingId = barcodeScannerPickingId;
        const confirmButton = document.getElementById("confirmLocationButton");
        
        if (!pickingId || !selectedLocationId || inventory.isActionInProgress()) {
            return;
        }

        const location = inventoryLocations.find(
            (item) => Number(item.id) === Number(selectedLocationId),
        );

        if (!location) {
            inventory.showToast("O local selecionado não foi encontrado.", "!");
            return;
        }

        const originalText = confirmButton?.textContent || "CONFIRMAR";
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.textContent = "SALVANDO...";
        }

        let data;

        try {
            await inventory.runAction(async () => {
                const response = await fetch(`/api/inventario/pickings/${pickingId}/location`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ 
                            location_id: selectedLocationId
                        }),
                    }
                );

                data = await response.json().catch(() => ({}));
                console.log("Resposta do envio do local selecionado:", data);
                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Não foi possível definir o local.",
                    );
                }
            });

            const picking = inventory.getRecord(pickingId);

            if (picking) {
                picking.local = data.local || location.name;

                picking.barcodeRegistered = Boolean(picking.local);
            }

            window.AppUI.closeModal("barcodeScannerModal");

            inventory.render();
            
            inventory.showToast(`LOCAL DEFINIDO: ${data.local || location.name}`);
        } catch (error) {
            console.error("Erro ao definir local manualmente:", error);

            inventory.showToast(error.message || "Não foi possível definir o local.", "!");
        } finally {
            if (confirmButton) {
                confirmButton.disabled = !selectedLocationId;

                confirmButton.textContent = originalText;
            }
        }
    }

    function showBarcodeScannerView() {
        document.getElementById("barcodeScannerView")?.classList.remove("hidden");
        document.getElementById("locationSelectionView")?.classList.add("hidden");

        const searchInput = document.getElementById("locationSearchInput");

        if (searchInput) {
            searchInput.value = "";
        }

        resetLocationSelection();
    }

    function showLocationSelectionView() {
        document.getElementById("barcodeScannerView")?.classList.add("hidden");
        document.getElementById("locationSelectionView")?.classList.remove("hidden");
    }

    function backToBarcodeScanner() {
        const pickingId = barcodeScannerPickingId;

        showBarcodeScannerView();

        if (pickingId) {
            openBarcodeScanner(pickingId);
        }
    }

    function resetLocationSelection() {
        selectedLocationId = null;

        const confirmButton = document.getElementById("confirmLocationButton");
        
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.textContent = "CONFIRMAR";
        }

        const status = document.getElementById("locationSelectionStatus");
        
        if (status) {
            status.textContent = "";
        }

        const list = document.getElementById("locationList");

        if (list && inventoryLocations.length) {
            renderLocationList(inventoryLocations);
        }
    }

    async function enviarParaConferenciaExpedicao(pickingId) {
        if (!pickingId || inventory.isActionInProgress()) {
            return;
        }
        
        try {
            await inventory.runAction(async () => {
                const response = await fetch(`/api/inventario/pickings/${pickingId}/enviar-conferencia-expedicao`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        picking_id: pickingId,
                    }),
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.detail || "Não foi possível enviar para conferência.");
                }

                inventory.showToast("Picking enviado para conferência com sucesso.");
                
                window.location.reload();
            });
        } catch (error) {
            console.error("Erro ao enviar para conferência:", error);
            inventory.showToast(error.message || "Não foi possível enviar para conferência.", "!");
        }
    }

    inventory.configure({
        enhanceCard,
        onInitialized: setBarcodeScanner,
    });
}());
