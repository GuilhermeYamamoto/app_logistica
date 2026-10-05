(function () {
    "use strict";
    // Modulo JS para a separacao
    
    const inventory = window.AppInventory;

    if (!inventory) {
        console.error("O controlador compartilhado do inventario não foi carregado.");
        return;
    }

    function isConferido(picking) {
        return (picking.tagIds || []).some(
            (tagId) => Number(tagId) === 29,
        );
    }
    
   function enhanceCard(card, picking, context) {
        // Herda o Card base e adiciona funcionalidades específicas para a separacao
        
        // Linhas do picking
        const moveLines = picking.move_lines || [];
       
        // Quantidade total de embalagens
        const qtdEmbalagens = moveLines.length;

        // Altera o preenchimento da quantidade concluida que vem do base.js, para o somatorio das quantidades concluidas das lines do picking         
        const somatorioQtyDone = moveLines.reduce((total, line) => total + (line.qty_done || 0), 0);
        const quantityInput = context.main.querySelector(".quantity-input")
        
        function atualizarQuantidadeRecebida() {
            const total = moveLines.reduce((total, line) => {
                return total + (Number(line.qty_done) || 0);
            }, 0);

            quantityInput.value = total;
        }

        // ***** Troca o campo Fornecedor por SO-Cliente *****
        const clientInfo = context.main.querySelector(".client-info");
    
        const label = clientInfo.querySelector("strong");
        const value = clientInfo.querySelector("h3");

        if (label) {
            label.textContent = "Pedido de Venda / Cliente";
        }

        if (value) {
            value.textContent = picking.pedido_venda_name + ' / ' + picking.cliente;
        }

        // ***** Adiciona segunda linha de informações do picking *****
    
        const secondaryInfoRow = document.createElement("div");
        secondaryInfoRow.className = "secondary-info-row";

        // *** Campo Quantidade Total Embalagens Picking ***
        const qtdEmbalagensBox = document.createElement("div");
        qtdEmbalagensBox.className = "secondary-info-box-1";

        const qtdEmbalagensLabel = document.createElement("div");
        qtdEmbalagensLabel.className = "qtd-embalagens-label";

        const qtdEmbalagensStyle = document.createElement("strong");
        qtdEmbalagensStyle.textContent = "Quantidade Total Embalagens";

        qtdEmbalagensLabel.appendChild(qtdEmbalagensStyle);

        const qtdEmbalagensValue = document.createElement("div");
        qtdEmbalagensValue.className = "secondary-info-value";
        qtdEmbalagensValue.textContent = qtdEmbalagens;

        qtdEmbalagensBox.appendChild(qtdEmbalagensLabel);
        qtdEmbalagensBox.appendChild(qtdEmbalagensValue);

        // *** Campo Peso Total Picking ***
        const pesoTotalBox = document.createElement("div");
        pesoTotalBox.className = "secondary-info-box-3";
        
        const pesoTotalLabel = document.createElement("div");
        pesoTotalLabel.className = "secondary-info-label";
        
        const pesoTotalStyle = document.createElement("strong");
        pesoTotalStyle.textContent = "Peso Total Picking (Kg)";
        
        pesoTotalLabel.appendChild(pesoTotalStyle);

        const pesoTotalValue = document.createElement("div");
        pesoTotalValue.className = "secondary-info-value";
        pesoTotalValue.textContent = 0;

        pesoTotalBox.appendChild(pesoTotalLabel);
        pesoTotalBox.appendChild(pesoTotalValue);

        // Adiciona os dois na mesma linha
        secondaryInfoRow.appendChild(qtdEmbalagensBox);
        secondaryInfoRow.appendChild(pesoTotalBox);

        // Adiciona a segunda linha ao card
        context.main.appendChild(secondaryInfoRow);

        // ***** Adiciona terceira linha de informações do picking *****
    
        const tertiaryInfoRow = document.createElement("div");
        tertiaryInfoRow.className = "secondary-info-row";

        // *** Campo Quantidade Total Embalagens Picking ***
        const tipoEmbalagemBox = document.createElement("div");
        tipoEmbalagemBox.className = "secondary-info-box-1";

        const tipoEmbalagemLabel = document.createElement("div");
        tipoEmbalagemLabel.className = "secondary-info-label";

        const tipoEmbalagemStyle = document.createElement("strong");
        tipoEmbalagemStyle.textContent = "Tipo do Pacote";

        tipoEmbalagemLabel.appendChild(tipoEmbalagemStyle);

        const tipoEmbalagemValue = document.createElement("div");
        tipoEmbalagemValue.className = "secondary-info-value";
        const tipoPacote = moveLines[0].package_type_id[1] ? moveLines[0].package_type_id[1] : "Não definido";
        tipoEmbalagemValue.textContent = tipoPacote;
        tipoEmbalagemBox.appendChild(tipoEmbalagemLabel);
        tipoEmbalagemBox.appendChild(tipoEmbalagemValue);

        tertiaryInfoRow.appendChild(tipoEmbalagemBox);

        // Adiciona a terceira linha ao card
        context.main.appendChild(tertiaryInfoRow);

        // **********************************
        // ***** Botões de ação do card *****
        // **********************************
        
        // *** Botão "Ler Embalagem" ao card ***
        const addPesoPacotes = document.createElement("button");
        
        addPesoPacotes.classList.add("main-action", "ler-embalagem-action");
        addPesoPacotes.innerHTML = '<span class="action-icon-small">⚖️</span>Adicionar Peso Pacotes';

        context.addSecondaryAction(addPesoPacotes);
        
        addPesoPacotes.addEventListener("click", () => openModalReplicarPeso(picking));

        // *** Botão "Ler Embalagem" ao card ***
        const imprimirEtqPacotes = document.createElement("button");
        
        imprimirEtqPacotes.classList.add("main-action", "ler-embalagem-action");
        imprimirEtqPacotes.innerHTML = '<span class="action-icon-small">🖨️</span>Imprimir Etiqueta Embalagens';
        imprimirEtqPacotes.addEventListener("click", () => {printLabel(picking)});

        context.addSecondaryAction(imprimirEtqPacotes);

        // *** Botão "Ler Embalagem" ao card ***
        const conferirSeparacao = document.createElement("button");
        
        conferirSeparacao.classList.add("main-action", "ler-embalagem-action");
        conferirSeparacao.innerHTML = '<span class="action-icon-small">⚖️</span>Conferir Separação';

        context.addSecondaryAction(conferirSeparacao);
        
        conferirSeparacao.addEventListener("click", async () => {
            try {
                const response = await fetch(`/api/inventario/pickings/${picking.id}/conferir-separacao`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ picking_id: picking.id }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.detail || "Não foi possível conferir a separação.");
                }
                inventory.showToast(`Solicitada Conferência do picking ${picking.pv} com sucesso!`);
            } catch (error) {
                console.error("Erro ao conferir separação:", error);
                inventory.showToast(error.message || "Não foi possível solicitar a conferência da separação.", "!");
            } finally {
                window.location.reload();
            }
        });

        // ***** Adiciona o botão de expandir linhas do Picking *****
        const pickingLines = document.createElement("section");
        pickingLines.className = "picking-lines";

        const linesContent = document.createElement("div");
        linesContent.className = "picking-lines-content";

        function atualizarPesoTotal() {
            const total = moveLines.reduce((total, line) => {
                return total + (Number(line.peso) || 0);
            }, 0);

            pesoTotalValue.textContent = total.toFixed(2);
        }
    
        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "picking-lines-toggle";
        toggleButton.setAttribute("aria-expanded", "false");
        toggleButton.setAttribute("aria-label", "Expandir Picking Lines");

        const toggleIcon = document.createElement("span");
        toggleIcon.className = "picking-lines-toggle-icon";
        toggleIcon.textContent = "▾";

        toggleButton.appendChild(toggleIcon);
        pickingLines.appendChild(linesContent);
        pickingLines.appendChild(toggleButton);

        // Coloca o botão de expansao das linhas do picking na borda inferior do picking-card
        card.appendChild(pickingLines);

        // Adiciona o evento de clique para expandir/colapsar as linhas do picking
        function togglePickingLines() {
            const expanded =
                toggleButton.getAttribute("aria-expanded") === "true";

            if (expanded) {
                linesContent.hidden = true;
                toggleButton.setAttribute("aria-expanded", "false");
                toggleIcon.textContent = "▾";
                return;
            }

            linesContent.innerHTML = "";

            // Cabeçalho das colunas
            if (moveLines.length > 0) {
                const header = document.createElement("div");
                header.className = "picking-lines-header";

                header.innerHTML = `
                    <div><strong>Quantidade</strong></div>
                    <div><strong>Peso</strong></div>
                    <div><strong>Lote</strong></div>
                `;

                linesContent.appendChild(header);
            }

            moveLines.forEach((line) => {
                const lineElement = document.createElement("div");
                lineElement.className = "picking-line-item";

                const peso = line.peso || 0;
                const qtyDone = line.qty_done || 0;
                const productUom = line.product_uom_id ? line.product_uom_id[1] : "";
                const packageType = line.package_type_id
                    ? line.package_type_id[1]
                    : "Não definido";
                const lot = line.lot_id
                    ? line.lot_id[1]
                    : "Não definido";

                lineElement.innerHTML = `
                    <div class="picking-line-quantity">
                        <input class="quantity-input" type="number"
                               value="${qtyDone}" step="0.01" min="0"/>
                        <span>${productUom}</span>
                    </div>

                    <div class="picking-line-weight">
                        <input class="quantity-input peso-input" type="number"
                               value="${peso}" step="0.01" min="0"/>Kg
                    </div>

                    <div class="picking-line-lot">
                        <h3>${lot}</h3>
                    </div>
                `;

                linesContent.appendChild(lineElement);

                const qtyDoneInput =
                    lineElement.querySelector(".quantity-input");

                qtyDoneInput.addEventListener("change", () => {
                    inventory.updateReceivedQuantity(
                        picking,
                        qtyDoneInput,
                        line.id
                    );

                    line.qty_done = Number(qtyDoneInput.value);

                    atualizarQuantidadeRecebida();
                });

                const pesoInput =
                    lineElement.querySelector(".peso-input");

                pesoInput.addEventListener("input", () => {
                    line.peso = Number(pesoInput.value) || 0;
                    atualizarPesoTotal();
                });

                pesoInput.addEventListener("change", () =>
                    updatePesoValue(picking, pesoInput, line.id)
                );
            });

            if (moveLines.length === 0) {
                linesContent.innerHTML = `
                    <div class="picking-line-empty">
                        Nenhuma linha encontrada.
                    </div>
                `;
            }

            linesContent.hidden = false;
            toggleButton.setAttribute("aria-expanded", "true");
            toggleIcon.textContent = "▴";
        }

        toggleButton.addEventListener("click", (event) => {
            event.stopPropagation();
            togglePickingLines();
        });

        card.addEventListener("click", (event) => {
            // Elementos que possuem comportamento próprio
            // não devem expandir/recolher as linhas.
            if (
                event.target.closest("button") ||
                event.target.closest("input") ||
                event.target.closest("select") ||
                event.target.closest("textarea") ||
                event.target.closest("a")
            ) {
                return;
            }

            togglePickingLines();
        });

        function openModalReplicarPeso(picking) {
            window.AppUI.openModal(
                "replicarPesoModal",
            );
            const replicarPesoModal = document.getElementById("replicarPesoModal");
            const inputPesoForm = replicarPesoModal.querySelector("#inputPesoForm");
            inputPesoForm?.addEventListener("submit", submitReplicarPeso);
        }

        async function submitReplicarPeso(event) {
            event.preventDefault();
            const pesoPacotes = document.getElementById("replicarPesoModal").querySelector("#pesoPacotes").value;
            const novoPeso = Number(pesoPacotes);
            const payload = {
                picking_id: picking.id,
                peso: pesoPacotes,
            };
            try {
                const response = await fetch(
                    "/api/replicar-peso", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(payload),
                    },
                );
                const data = await response.json().catch(() => ({}));
                
                if (response.ok) {
                    window.AppUI.closeModal("replicarPesoModal");
                    AppInventory.showToast("Peso replicado com sucesso!", "✓");
                    // Atualiza o peso das lines no card
                    picking.move_lines.forEach((line) => {line.peso = novoPeso});
                } 
            } catch (error) {
                    console.error("Erro ao replicar peso:", error);
                    AppInventory.showToast("Erro ao replicar peso. Tente novamente.", "✗");
            } finally {
                AppInventory.render();
            };
        }

        async function printLabel(picking) {
            try {
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
            } catch (error) {
                console.error("Erro ao imprimir etiqueta:", error);
                inventory.showToast(error.message || "Não foi possível imprimir a etiqueta.", "!");
            }
        }
        
        async function updatePesoValue(picking, input, lineId = null) {
            const value = Number(input.value);
            try {
                const response = await fetch("/api/peso-value", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        picking_id: picking.id,
                        move_line_id: lineId,
                        peso_value: value,
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.detail || "Erro ao atualizar quantidade.");
                }
                AppInventory.showToast("Quantidade atualizada.");
            } catch (error) {
                console.error("Erro ao atualizar quantidade:", error);
                AppInventory.showToast(error.message || "Erro ao atualizar quantidade.", "!");
            };
        }

        atualizarPesoTotal();
   }

    // Configura o módulo de inventário com a função enhanceCard e permite a edição de quantidade
    inventory.configure({
        enhanceCard,
        getSectionTitle: (filter) => filter === "andamento"
            ? "PICKINGS CONFERIDOS"
            : "PICKINGS PENDENTES",
        getStatus: (picking) => isConferido(picking)
            ? { label: "CONFERIDO", className: "status-progress" }
            : { label: "PENDENTE", className: "status-waiting" },
        isInProgress: isConferido,
        isPending: (picking) =>
            !picking.validated &&
            !isConferido(picking),
    })
}());
