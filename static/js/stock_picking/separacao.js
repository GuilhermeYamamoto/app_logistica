(function () {
    "use strict";
    // Modulo JS para a separacao
    
    const inventory = window.AppInventory;

    if (!inventory) {
        console.error("O controlador compartilhado do inventario não foi carregado.");
        return;
    }

    let selectedConferenciaPicking = null;
    let selectedReplicarPesoPicking = null;

    // Retorna true quando o picking possui a tag 29, usada pelo Odoo
    // para indicar que a separação foi conferida.
    function isConferido(picking) {
        return (picking.tagIds || []).some(
            (tagId) => Number(tagId) === 29,
        );
    }

    // Consulta novamente os pickings da etapa no FastAPI.
    // O backend consulta o Odoo e devolve também o campo
    // divergencia_peso_picking atualizado.
    async function fetchStageRecords() {
        const stageKey = document.body.dataset.stageKey;
        const response = await fetch(
            `/api/inventario/pickings/refresh/${encodeURIComponent(stageKey)}?t=${Date.now()}`,
            {
                headers: { Accept: "application/json" },
                cache: "no-store",
            },
        );
        const data = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(data?.records)) {
            throw new Error(
                data?.detail || "Não foi possível atualizar as separações.",
            );
        }

        return data.records;
    }

    // Atualiza os registros exibidos sem recarregar a página.
    // Como replaceRecords recria os cards, este método guarda quais
    // pickings estavam expandidos e reabre os mesmos após o render.
    async function refreshStageRecords() {
        const expandedRecordIds = new Set(
            Array.from(
                document.querySelectorAll(".picking-card"),
            )
                .filter((card) =>
                    card.querySelector(
                        '.picking-lines-toggle[aria-expanded="true"]',
                    ),
                )
                .map((card) => card.dataset.recordId),
        );
        const records = await fetchStageRecords();
        inventory.replaceRecords(records);

        document
            .querySelectorAll(".picking-card")
            .forEach((card) => {
                if (!expandedRecordIds.has(card.dataset.recordId)) {
                    return;
                }

                card
                    .querySelector(".picking-lines-toggle")
                    ?.click();
            });
    }

    // Abre o modal de replicação e registra qual picking será atualizado.
    // O formulário do modal possui um único listener, configurado em
    // initializeReplicarPesoModal().
    function openModalReplicarPeso(picking) {
        if (inventory.isActionInProgress()) {
            return;
        }

        selectedReplicarPesoPicking = picking;
        const pesoInput = document
            .getElementById("replicarPesoModal")
            ?.querySelector("#pesoPacotes");
        if (pesoInput) {
            pesoInput.value = "";
        }
        window.AppUI.openModal("replicarPesoModal");
    }

    // Envia o peso informado para o wizard do Odoo, aguarda a atualização
    // e sincroniza novamente os registros exibidos na etapa.
    async function submitReplicarPeso(event) {
        event.preventDefault();

        if (inventory.isActionInProgress()) {
            return;
        }

        const picking = selectedReplicarPesoPicking;
        const modal = document.getElementById("replicarPesoModal");
        const pesoPacotes = modal?.querySelector("#pesoPacotes")?.value;

        if (!picking || pesoPacotes === undefined) {
            return;
        }

        const confirmed = await window.AppUI.confirmAction({
            kicker: "ALTERAÇÃO DE PESO",
            title: "REPLICAR PESO",
            text: `Deseja replicar o peso de ${pesoPacotes} kg para os pacotes do picking ${picking.pv}?`,
            confirmLabel: "REPLICAR PESO",
        });
        if (!confirmed) {
            return;
        }

        try {
            await inventory.runAction(async () => {
                const response = await fetch(
                    "/api/replicar-peso", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            picking_id: picking.id,
                            peso: pesoPacotes,
                        }),
                    },
                );
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.detail || "Não foi possível replicar o peso.",
                    );
                }

                window.AppUI.closeModal("replicarPesoModal");
                await refreshStageRecords();
                inventory.showToast("Peso replicado com sucesso!", "✓");
            });
        } catch (error) {
            console.error("Erro ao replicar peso:", error);
            inventory.showToast(
                error.message || "Erro ao replicar peso. Tente novamente.",
                "✗",
            );
        } finally {
            selectedReplicarPesoPicking = null;
        }
    }

    // Registra uma única vez o submit do modal global de replicação.
    function initializeReplicarPesoModal() {
        document
            .getElementById("inputPesoForm")
            ?.addEventListener(
                "submit",
                submitReplicarPeso,
            );
    }

    initializeReplicarPesoModal();

    // Abre o modal de confirmação para a ação "Conferir Separação".
    // O picking fica armazenado temporariamente até o usuário confirmar
    // ou cancelar a operação.
    function openConferenciaSeparacaoModal(picking) {
        if (inventory.isActionInProgress()) {
            return;
        }

        selectedConferenciaPicking = picking;

        const confirmationText = document.getElementById(
            "conferenciaSeparacaoText",
        );
        if (confirmationText) {
            confirmationText.textContent =
                `Deseja realmente solicitar a conferência do picking ${picking.pv}?`;
        }

        window.AppUI.openModal("conferenciaSeparacaoModal");
    }

    // Envia a solicitação ao FastAPI somente depois da confirmação.
    // runAction aplica o carregamento global e impede ações concorrentes.
    async function confirmConferenciaSeparacao() {
        const picking = selectedConferenciaPicking;
        const button = document.getElementById(
            "confirmConferenciaSeparacao",
        );

        if (!picking || inventory.isActionInProgress()) {
            return;
        }

        const originalText = button?.textContent;
        if (button) {
            button.disabled = true;
            button.textContent = "CONFIRMANDO...";
        }

        try {
            await inventory.runAction(async () => {
                const response = await fetch(
                    `/api/inventario/pickings/${picking.id}/conferir-separacao`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ picking_id: picking.id }),
                    },
                );

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.detail ||
                        "Não foi possível conferir a separação.",
                    );
                }

                window.AppUI.closeModal("conferenciaSeparacaoModal");
                inventory.showToast(
                    `Solicitada Conferência do picking ${picking.pv} com sucesso!`,
                );
                window.location.reload();
            });
        } catch (error) {
            console.error("Erro ao conferir separação:", error);
            inventory.showToast(
                error.message ||
                "Não foi possível solicitar a conferência da separação.",
                "!",
            );
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalText;
            }
        }
    }

    // Registra uma única vez o botão de confirmação do modal.
    // O modal é compartilhado por todos os cards da etapa.
    function initializeConferenciaSeparacaoModal() {
            document
                .getElementById("confirmConferenciaSeparacao")
                ?.addEventListener(
                    "click",
                    confirmConferenciaSeparacao,
                );
    }

    initializeConferenciaSeparacaoModal();
    
   // Personaliza o card padrão do inventário para a etapa de separação.
   // Aqui são criados os campos, botões, linhas de embalagem e eventos
   // específicos desta etapa.
   function enhanceCard(card, picking, context) {
        // Herda o Card base e adiciona funcionalidades específicas para a separacao
        
        // Linhas do picking
        const moveLines = picking.move_lines || [];
        const conferido = isConferido(picking);
        const pesoDivergente = Boolean(picking.divergencia_peso_picking);
        const pesoConferido = !pesoDivergente;

        // O card base cria ações padrão automaticamente. Nesta etapa,
        // pickings pendentes exibem suas ações operacionais nas ações
        // secundárias; pickings conferidos exibem somente "Concluído".
        const primaryActions = [];
        if (conferido) {
            primaryActions.push(
                context.createValidationAction(),
            );
        }
        context.replacePrimaryActions(primaryActions);
       
        // Quantidade total de embalagens
        const qtdEmbalagens = moveLines.length;

        const quantityInput = context.main.querySelector(".quantity-input")
        
        // Soma o qty_done de todas as move lines e atualiza o campo
        // de quantidade exibido no cabeçalho do card.
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

        // ***** Campo tipo de pacote do Picking *****
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

        // ***** Campo Peso Divergente do Picking *****
        const pesoDivergenteBool = document.createElement("div");
        pesoDivergenteBool.className = "secondary-info-box-3";

        const pesoDivergenteLabel = document.createElement("div");
        pesoDivergenteLabel.className = "secondary-info-label";

        const pesoDivergenteStyle = document.createElement("strong");
        pesoDivergenteStyle.textContent = "Peso Divergente";

        pesoDivergenteLabel.appendChild(pesoDivergenteStyle);

        const pesoDivergenteValue = document.createElement("div");
        pesoDivergenteValue.className = "secondary-info-value";
        const isPesoDivergente = picking.divergencia_peso_picking ? "Sim" : "Não";
        pesoDivergenteValue.textContent = isPesoDivergente;
        pesoDivergenteBool.appendChild(pesoDivergenteLabel);
        pesoDivergenteBool.appendChild(pesoDivergenteValue);

        tertiaryInfoRow.appendChild(pesoDivergenteBool);

        // Adiciona a terceira linha ao card
        context.main.appendChild(tertiaryInfoRow);

        // **********************************
        // ***** Botões de ação do card *****
        // **********************************
        
        // Todas as ações secundárias ficam disponíveis somente enquanto o
        // picking está pendente. Depois da conferência, resta apenas validar.
        if (!conferido) {
            // *** Adiciona Botão "Adicionar Peso Pacotes" ao card ***
            const addPesoPacotes = document.createElement("button");

            addPesoPacotes.type = "button";
            addPesoPacotes.classList.add(
                "secondary-action",
                "package-action",
            );
            if (!pesoDivergente) {
                addPesoPacotes.classList.add("full-width-action");
            }
            addPesoPacotes.innerHTML =
                '<span class="action-icon-small">⚖️</span>Adicionar Peso Pacotes';

            context.addSecondaryAction(addPesoPacotes);

            // Abre o modal para informar um peso que será replicado nas linhas.
            addPesoPacotes.addEventListener(
                "click",
                () => openModalReplicarPeso(picking),
            );

            // O botão só é exibido quando o campo calculado pelo Odoo
            // indica que existe divergência de peso neste picking.
            if (pesoDivergente) {
                const corrigirPesoDivergente = document.createElement("button");

                corrigirPesoDivergente.type = "button";
                corrigirPesoDivergente.classList.add(
                    "secondary-action",
                    "correction-action",
                );
                corrigirPesoDivergente.innerHTML =
                    '<span class="action-icon-small">🛠️</span>Corrigir Peso Divergente';

                context.addSecondaryAction(corrigirPesoDivergente);

                // Abre no Odoo a solicitação de correção do peso divergente.
                corrigirPesoDivergente.addEventListener(
                    "click",
                    async () => {
                        const confirmed = await window.AppUI.confirmAction({
                            kicker: "CORREÇÃO DE PESO",
                            title: "CORRIGIR PESO DIVERGENTE",
                            text: `Deseja solicitar a correção do peso divergente do picking ${picking.pv}?`,
                            confirmLabel: "CORRIGIR PESO",
                        });
                        if (!confirmed) {
                            return;
                        }

                        try {
                            await inventory.runAction(async () => {
                                const response = await fetch(
                                    `/api/inventario/pickings/${picking.id}/corrigir-peso-divergente`,
                                    {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                            picking_id: picking.id,
                                        }),
                                    },
                                );
                                const data = await response.json().catch(() => ({}));
                                if (!response.ok) {
                                    throw new Error(
                                        data.detail ||
                                        "Não foi possível abrir a solicitação de correção.",
                                    );
                                }
                                inventory.showToast(
                                    `Solicitada Correção de peso do picking ${picking.pv} com sucesso!`,
                                );
                            });
                        } catch (error) {
                            console.error(
                                "Erro ao solicitar correcao de peso:",
                                error,
                            );
                            inventory.showToast(
                                error.message ||
                                "Não foi possível solicitar a correção do peso do produto.",
                                "!",
                            );
                        }
                    },
                );
            }

            // Nos pickings pendentes, qualidade e impressão compartilham
            // a mesma linha de ações.
            context.addSecondaryAction(
                context.createQualityAction(
                    "secondary-action quality-action",
                ),
            );

            // *** Adiciona Botão "Imprimir Etiqueta Embalagens" ao card ***
            const imprimirEtqPacotes = document.createElement("button");

            imprimirEtqPacotes.type = "button";
            imprimirEtqPacotes.classList.add(
                "secondary-action",
                "print-action",
            );
            imprimirEtqPacotes.disabled = !pesoConferido;
            if (!pesoConferido) {
                imprimirEtqPacotes.title =
                    "Preencha e corrija o peso antes de imprimir.";
            }
            imprimirEtqPacotes.innerHTML =
                '<span class="action-icon-small">🖨️</span>Imprimir Etiqueta Embalagens';
            // Solicita a impressão das etiquetas das embalagens deste picking.
            imprimirEtqPacotes.addEventListener(
                "click",
                () => printLabel(picking),
            );

            context.addSecondaryAction(imprimirEtqPacotes);

            const conferirSeparacao = document.createElement("button");

            conferirSeparacao.type = "button";
            conferirSeparacao.classList.add(
                "secondary-action",
                "conference-action",
            );
            conferirSeparacao.disabled = !pesoConferido;
            if (!pesoConferido) {
                conferirSeparacao.title =
                    "Preencha e corrija o peso antes de conferir.";
            }
            conferirSeparacao.innerHTML =
                '<span class="action-icon-small">✅</span>Conferir Separação';

            context.addSecondaryAction(conferirSeparacao);

            // Abre a confirmação; a requisição só é enviada pelo botão
            // "CONFIRMAR" do modal.
            conferirSeparacao.addEventListener(
                "click",
                () => openConferenciaSeparacaoModal(picking),
            );
        }

       // ***** Adiciona o botão de expandir linhas do Picking *****
        const pickingLines = document.createElement("section");
        pickingLines.className = "picking-lines";

        const linesContent = document.createElement("div");
        linesContent.className = "picking-lines-content";

        // Recalcula o peso total mostrado no resumo do card a partir
        // dos pesos atuais das move lines em memória.
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
        // Expande ou recolhe as move lines do picking.
        // Quando expande, o conteúdo é recriado para refletir os dados
        // mais recentes existentes no objeto picking.
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

            // Cria uma linha visual para cada stock.move.line retornada
            // pelo Odoo e conecta os eventos dos campos editáveis.
            moveLines.forEach((line) => {
                const lineElement = document.createElement("div");
                lineElement.className = "picking-line-item";

                const peso = line.peso || 0;
                const qtyDone = line.qty_done || 0;
                const productUom = line.product_uom_id ? line.product_uom_id[1] : "";
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

                // Salva a quantidade recebida no endpoint compartilhado
                // e atualiza o total exibido no card.
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

                // Atualiza imediatamente o total visual enquanto o usuário
                // digita. A persistência ocorre somente no evento change.
                pesoInput.addEventListener("input", () => {
                    line.peso = Number(pesoInput.value) || 0;
                    atualizarPesoTotal();
                });

                // Salva o peso da move line no Odoo quando o campo perde foco
                // ou o usuário confirma a alteração.
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

        // Impede que o clique no botão também acione o clique geral do card.
        toggleButton.addEventListener("click", (event) => {
            event.stopPropagation();
            togglePickingLines();
        });

        // Permite expandir/recolher clicando no card, exceto quando o
        // clique veio de um controle que já possui ação própria.
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

        // Solicita ao FastAPI os dados da etiqueta e, em seguida,
        // envia esses dados para a impressora IoT.
        async function printLabel(picking) {
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
        
        // Persiste o peso de uma move line no Odoo.
        // runAction exibe o carregamento global durante o POST e durante
        // a consulta seguinte que atualiza o campo de divergência.
        async function updatePesoValue(picking, input, lineId = null) {
            const value = Number(input.value);
            try {
                await inventory.runAction(async () => {
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
                        throw new Error(data.detail || "Erro ao atualizar peso.");
                    }
                    await refreshStageRecords();
                    inventory.showToast("Peso atualizado.");
                });
            } catch (error) {
                console.error("Erro ao atualizar peso:", error);
                AppInventory.showToast(error.message || "Erro ao atualizar peso.", "!");
            }
        }

        atualizarPesoTotal();
   }

    // Registra as regras específicas da etapa no controlador compartilhado.
    // O base.js continua responsável pelo estado, filtros e renderização;
    // este arquivo apenas informa como a separação deve se comportar.
    inventory.configure({
        enhanceCard,
        // Textos exibidos conforme o filtro selecionado no dashboard.
        getSectionTitle: (filter) => filter === "andamento"
            ? "PICKINGS CONFERIDOS"
            : "PICKINGS PENDENTES",
        // Converte o estado do picking em texto e classe visual do status.
        getStatus: (picking) => isConferido(picking)
            ? { label: "CONFERIDO", className: "status-progress" }
            : { label: "PENDENTE", className: "status-waiting" },
        // Define quais registros entram na seção "em andamento".
        isInProgress: isConferido,
        // Define quais registros permanecem na seção de pendentes.
        isPending: (picking) =>
            !picking.validated &&
            !isConferido(picking),
        // O botão "Concluído" já usa o validationModal compartilhado do
        // base.js. Estas opções apenas personalizam o texto da confirmação.
        validationText: (picking) =>
            `Deseja realmente concluir o picking ${picking.pv}?`,
        validationSuccessMessage: () =>
            "SEPARAÇÃO CONCLUÍDA COM SUCESSO",
        // Define o comportamento do pull-to-refresh desta etapa.
        // Ele reutiliza a mesma consulta usada após salvar um peso.
        refreshRecords: async ({ replaceRecords, showToast }) => {
            const records = await fetchStageRecords();
            replaceRecords(records);
            showToast("SEPARAÇÕES ATUALIZADAS");
        },
    })
}());
