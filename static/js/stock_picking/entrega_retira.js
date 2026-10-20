(function () {
    "use strict";

    const inventory = window.AppInventory;
    if (!inventory) {
        console.error("O controlador compartilhado do inventário não foi carregado.");
        return;
    }

    let selectedBatch = null;
    let canhotoInputInitialized = false;
    let currentCanhotoPhoto = null;
    let canhotoSaving = false;

    function displayValue(value, fallback = "Não informado") {
        if (value === null || value === undefined || value === false || value === "") {
            return fallback;
        }
        return String(value);
    }

    function formatNumber(value, maximumFractionDigits = 2) {
        if (value === null || value === undefined || value === "") {
            return "Não informado";
        }
        const number = Number(value);
        return Number.isFinite(number)
            ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(number)
            : displayValue(value);
    }

    function formatDate(value) {
        if (!value) {
            return "Não informado";
        }
        const date = new Date(String(value).replace(" ", "T"));
        return Number.isNaN(date.getTime())
            ? displayValue(value)
            : new Intl.DateTimeFormat("pt-BR").format(date);
    }

    function groupRecordsByBatch(records) {
        const groups = new Map();
        for (const record of records || []) {
            const key = record.batch_id === null || record.batch_id === undefined
                ? "__NO_BATCH__"
                : String(record.batch_id);
            if (!groups.has(key)) {
                groups.set(key, { key, records: [] });
            }
            groups.get(key).records.push(record);
        }
        return Array.from(groups.values());
    }

    function createField(label, value) {
        const field = document.createElement("div");
        field.className = "delivery-summary-field";
        const fieldLabel = document.createElement("span");
        fieldLabel.className = "delivery-summary-label";
        fieldLabel.textContent = label;
        const fieldValue = document.createElement("strong");
        fieldValue.className = "delivery-summary-value";
        fieldValue.textContent = displayValue(value);
        field.append(fieldLabel, fieldValue);
        return field;
    }

    function getSummaryFields(record) {
        const cityState = [record.deliveryCity, record.deliveryState]
            .filter((value) => value !== null && value !== undefined && value !== "")
            .join(" / ");
        return [
            ["Número da NF", record.invoiceNumber],
            ["Local do Material", record.materialLocation],
            ["Peso total", record.invoiceWeight],
            ["Qtd. Volumes", record.invoiceVolumeCount],
            ["Data de entrega", formatDate(record.scheduledDate)],
            ["Emissão da NF", formatDate(record.invoiceIssueDate)],
            ["Transportadora", record.carrier],
            ["Endereço de entrega", record.deliveryAddress],
            ["Município / UF", cityState || null],
        ];
    }

    function createPicking(record) {
        const picking = document.createElement("section");
        picking.className = "delivery-picking";
        const pickingTitle = document.createElement("h3");
        pickingTitle.textContent = displayValue(record.reference, "Picking");
        picking.append(pickingTitle);

        const table = document.createElement("div");
        table.className = "delivery-lines";
        const header = document.createElement("div");
        header.className = "delivery-line delivery-line-header";
        ["Produto", "Lote", "Quantidade concluída"].forEach((label) => {
            const cell = document.createElement("strong");
            cell.textContent = label;
            header.append(cell);
        });
        table.append(header);

        const moveLines = Array.isArray(record.move_lines) ? record.move_lines : [];
        for (const moveLine of moveLines) {
            const line = document.createElement("div");
            line.className = "delivery-line";
            [
                moveLine.product_id?.[1] || "Produto não informado",
                moveLine.lot_id?.[1] || "Sem lote",
                formatNumber(moveLine.qty_done),
            ].forEach((value) => {
                const cell = document.createElement("span");
                cell.textContent = value;
                line.append(cell);
            });
            table.append(line);
        }

        if (!moveLines.length) {
            const empty = document.createElement("p");
            empty.className = "delivery-lines-empty";
            empty.textContent = "Nenhuma linha de produto encontrada.";
            table.append(empty);
        }
        picking.append(table);
        return picking;
    }

    function openBatchModal(group) {
        selectedBatch = group;
        const firstRecord = group.records[0] || {};
        const title = document.getElementById("deliveryBatchModalTitle");
        const subtitle = document.getElementById("deliveryBatchModalSubtitle");
        const summary = document.getElementById("deliveryBatchModalSummary");
        const records = document.getElementById("deliveryBatchModalRecords");

        if (!title || !subtitle || !summary || !records) {
            return;
        }

        title.textContent = displayValue(firstRecord.pedido_venda_name, "Sem pedido de venda");
        subtitle.textContent = displayValue(firstRecord.cliente, "Cliente não definido");
        summary.replaceChildren(
            ...getSummaryFields(firstRecord).map(([label, value]) =>
                createField(label, value),
            ),
        );
        records.replaceChildren(
            ...group.records.map((record) => createPicking(record)),
        );
        window.AppUI.openModal("deliveryBatchModal");
    }

    function updateCanhotoInterface() {
        const preview = document.getElementById("deliveryCanhotoPreview");
        const confirmButton = document.getElementById("deliveryConfirmBatchButton");
        if (!preview || !confirmButton) {
            return;
        }

        preview.replaceChildren();
        if (currentCanhotoPhoto) {
            const slot = document.createElement("div");
            slot.className = "delivery-photo-slot";
            const image = document.createElement("img");
            image.className = "delivery-photo-preview";
            image.src = currentCanhotoPhoto.startsWith("data:")
                ? currentCanhotoPhoto
                : `data:image/jpeg;base64,${currentCanhotoPhoto}`;
            image.alt = "Foto do canhoto da nota fiscal";
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "remove-photo-button";
            removeButton.textContent = "×";
            removeButton.title = "Excluir foto e tirar outra";
            removeButton.addEventListener("click", () => {
                currentCanhotoPhoto = null;
                updateCanhotoInterface();
                inventory.showToast("FOTO REMOVIDA");
            });
            slot.append(image, removeButton);
            preview.append(slot);
        } else {
            const addPhotoButton = document.createElement("button");
            addPhotoButton.type = "button";
            addPhotoButton.className = "delivery-add-photo-button";
            addPhotoButton.innerHTML = '<span class="camera-icon">📷</span><span>TIRAR FOTO</span>';
            addPhotoButton.addEventListener("click", selectCanhotoPhoto);
            preview.append(addPhotoButton);
            const message = document.createElement("p");
            message.className = "delivery-photo-empty";
            message.textContent = "Nenhuma foto selecionada.";
            preview.append(message);
        }
        confirmButton.disabled =
            !selectedBatch ||
            !selectedBatch.records[0]?.batch_id ||
            !currentCanhotoPhoto;
    }

    function openCanhotoModal(group) {
        selectedBatch = group;
        currentCanhotoPhoto = group.records[0]?.canhotoPhoto || null;
        const info = document.getElementById("deliveryCanhotoInfo");
        if (info) {
            info.textContent = `${group.records[0]?.pedido_venda_name || "Pedido"} • ${group.records[0]?.cliente || "Cliente"}`;
        }
        updateCanhotoInterface();
        window.AppUI.openModal("deliveryCanhotoModal");
    }

    function selectCanhotoPhoto() {
        if (!selectedBatch || canhotoSaving || inventory.isActionInProgress()) {
            return;
        }
        const input = document.getElementById("deliveryCanhotoInput");
        if (input) {
            input.value = "";
            input.click();
        }
    }

    function readCanhotoPhoto(event) {
        const file = event.target.files?.[0];
        if (!file || !selectedBatch || canhotoSaving) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            inventory.showToast("Selecione uma imagem válida.", "!");
            return;
        }

        const batchId = selectedBatch.records[0]?.batch_id;
        if (!batchId) {
            inventory.showToast("Este agrupamento não possui batch.", "!");
            return;
        }

        const reader = new FileReader();
        reader.addEventListener("error", () => {
            inventory.showToast("Não foi possível carregar a foto.", "!");
        });
        reader.addEventListener("load", () => {
            currentCanhotoPhoto = reader.result;
            updateCanhotoInterface();
            inventory.showToast("Nova foto do canhoto adicionada.");
        });
        reader.readAsDataURL(file);
    }

    function openBatchConfirmation() {
        if (!selectedBatch || !currentCanhotoPhoto || canhotoSaving) {
            return;
        }
        const firstRecord = selectedBatch.records[0] || {};
        const text = document.getElementById("deliveryConfirmText");
        if (text) {
            text.textContent =
                `Deseja aprovar a fotografia e validar a entrega de ${firstRecord.pedido_venda_name || firstRecord.reference || "este batch"}?`;
        }
        window.AppUI.openModal("deliveryConfirmModal");
    }

    async function confirmBatch() {
        if (!selectedBatch || canhotoSaving || inventory.isActionInProgress()) {
            return;
        }

        const batchId = selectedBatch.records[0]?.batch_id;
        if (!batchId) {
            return;
        }

        canhotoSaving = true;
        const confirmButton = document.getElementById("deliveryConfirmActionButton");
        if (confirmButton) {
            confirmButton.disabled = true;
            confirmButton.textContent = "CONFIRMANDO...";
        }

        try {
            await inventory.runAction(async () => {
                if (currentCanhotoPhoto) {
                    const photoResponse = await fetch(
                        `/api/inventario/batches/${batchId}/canhoto`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ photo: currentCanhotoPhoto }),
                        },
                    );
                    const photoData = await photoResponse.json().catch(() => ({}));
                    if (!photoResponse.ok) {
                        throw new Error(
                            photoData.detail || "Não foi possível registrar a foto do canhoto.",
                        );
                    }
                }

                const response = await fetch(
                    `/api/inventario/batches/${batchId}/confirmar`,
                    { method: "POST" },
                );
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.detail || "Não foi possível confirmar o batch.");
                }

                window.AppUI.closeModal("deliveryConfirmModal");
                window.AppUI.closeModal("deliveryCanhotoModal");
                inventory.replaceRecords(
                    inventory
                        .getRecords()
                        .filter((record) => Number(record.batch_id) !== Number(batchId)),
                );
                inventory.showToast("Batch confirmado com sucesso.");
            });
        } catch (error) {
            console.error("Erro ao confirmar batch:", error);
            inventory.showToast(
                error.message || "Não foi possível confirmar o batch.",
                "!",
            );
        } finally {
            canhotoSaving = false;
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.textContent = "APROVAR E VALIDAR";
            }
        }
    }

    function initializeCanhotoInput() {
        if (canhotoInputInitialized) {
            return;
        }
        const input = document.getElementById("deliveryCanhotoInput");
        if (!input) {
            return;
        }
        canhotoInputInitialized = true;
        input.addEventListener("change", readCanhotoPhoto);
        document
            .getElementById("deliveryConfirmBatchButton")
            ?.addEventListener("click", openBatchConfirmation);
        document
            .getElementById("deliveryConfirmActionButton")
            ?.addEventListener("click", confirmBatch);
    }

    function renderBatchGroups(visibleRecords) {
        const container = document.getElementById("pickingsContainer");
        if (!container) {
            return;
        }
        const pendingBatches = groupRecordsByBatch(
            inventory.getRecords().filter((record) => !record.validated),
        ).length;
        const visibleBatches = groupRecordsByBatch(visibleRecords).length;
        const pendingCounter = document.getElementById("pendingCount");
        const resultCounter = document.getElementById("resultCount");
        if (pendingCounter) {
            pendingCounter.textContent = String(pendingBatches);
        }
        if (resultCounter) {
            resultCounter.textContent =
                `${visibleBatches} ${visibleBatches === 1 ? "registro" : "registros"}`;
        }
        container.replaceChildren();

        for (const group of groupRecordsByBatch(visibleRecords)) {
            const firstRecord = group.records[0] || {};
            const card = document.createElement("section");
            card.className = "delivery-batch-card";
            card.tabIndex = 0;
            card.setAttribute("role", "button");
            card.setAttribute(
                "aria-label",
                `Abrir detalhes de ${firstRecord.pedido_venda_name || "batch"}`,
            );

            const header = document.createElement("div");
            header.className = "delivery-batch-header";
            const title = document.createElement("span");
            title.className = "delivery-batch-title";
            title.textContent = `${displayValue(firstRecord.pedido_venda_name, "Sem pedido de venda")} - ${displayValue(firstRecord.cliente, "Cliente não definido")}`;

            const actions = document.createElement("div");
            actions.className = "delivery-batch-header-actions";
            const photoButton = document.createElement("button");
            photoButton.type = "button";
            photoButton.className = "delivery-canhoto-button";
            photoButton.textContent = "FOTO CANHOTO";
            photoButton.disabled = !firstRecord.batch_id;
            photoButton.addEventListener("click", (event) => {
                event.stopPropagation();
                openCanhotoModal(group);
            });
            actions.append(photoButton);
            header.append(title, actions);

            const summary = document.createElement("div");
            summary.className = "delivery-summary";
            summary.append(
                createField("Número da NF", firstRecord.invoiceNumber),
                createField("Endereço de entrega", firstRecord.deliveryAddress),
            );

            card.addEventListener("keydown", (event) => {
                if (event.target !== card) {
                    return;
                }
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openBatchModal(group);
                }
            });
            card.addEventListener("click", (event) => {
                if (event.target.closest("button, input, select, textarea, a")) {
                    return;
                }
                openBatchModal(group);
            });
            card.append(header, summary);
            container.append(card);
        }
    }

    initializeCanhotoInput();
    inventory.configure({ onAfterRender: renderBatchGroups });
}());
