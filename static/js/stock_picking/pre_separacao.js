(function () {
    "use strict";

    let selectedPicking = null;
    let users = [];
    let loadingUsers = false;
    let initialized = false;
    let openSelector = null;
    const DEFAULT_RESPONSIBLES = new Set([
        "silvando ferrei",
        "jose santos",
    ]);

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function normalizeResponsibleName(userName) {
        return String(userName || "")
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR")
            .replace(/\s+/g, " ");
    }

    function isDefaultResponsible(userName) {
        const normalizedName = normalizeResponsibleName(userName);

        return DEFAULT_RESPONSIBLES.has(normalizedName);
    }

    function closeAllSelectors(except = null) {
        document
            .querySelectorAll(".responsible-selector.is-open")
            .forEach((selector) => {
                if (selector !== except) {
                    selector.classList.remove("is-open");
                }
            });

        if (openSelector && openSelector !== except) {
            openSelector = null;
        }
    }

    function filterUsers(searchTerm) {
        const normalizedSearch = String(searchTerm || "")
            .trim()
            .toLocaleLowerCase("pt-BR");

        if (!normalizedSearch) {
            return users;
        }

        return users.filter((user) =>
            String(user.name || "")
                .toLocaleLowerCase("pt-BR")
                .includes(normalizedSearch),
        );
    }

    function renderUserList(selector, record, searchTerm = "") {
        const list = selector.querySelector(
            ".responsible-users-list",
        );

        if (!list) {
            return;
        }

        if (loadingUsers) {
            list.replaceChildren(
                createElement(
                    "div",
                    "responsible-users-loading",
                    "CARREGANDO USUÁRIOS...",
                ),
            );

            return;
        }

        if (!users.length) {
            list.replaceChildren(
                createElement(
                    "div",
                    "responsible-users-empty",
                    "Nenhum usuário ativo encontrado.",
                ),
            );

            return;
        }

        const filteredUsers = filterUsers(searchTerm);

        if (!filteredUsers.length) {
            list.replaceChildren(
                createElement(
                    "div",
                    "responsible-users-empty",
                    "Nenhum usuário encontrado.",
                ),
            );

            return;
        }

        const currentUserId = Number(record?.userId || 0);

        list.replaceChildren(
            ...filteredUsers.map((user) => {
                const button = createElement(
                    "button",
                    "responsible-user-option",
                );

                button.type = "button";

                if (Number(user.id) === currentUserId) {
                    button.classList.add("selected");
                }

                const icon = createElement(
                    "span",
                    "responsible-user-icon",
                    "◎",
                );

                const name = createElement(
                    "span",
                    "responsible-user-name",
                    user.name || "Usuário sem nome",
                );

                const check = createElement(
                    "span",
                    "responsible-user-check",
                    "✓",
                );

                button.append(
                    icon,
                    name,
                    check,
                );

                button.addEventListener(
                    "click",
                    (event) => {
                        event.stopPropagation();
                        assignResponsible(user, record);
                    },
                );

                return button;
            }),
        );
    }

    async function loadUsers() {
        if (loadingUsers) {
            return;
        }

        loadingUsers = true;

        document
            .querySelectorAll(".responsible-selector.is-open")
            .forEach((selector) => {
                const recordId = selector.dataset.recordId;

                if (recordId) {
                    const list = selector.querySelector(
                        ".responsible-users-list",
                    );

                    if (list) {
                        list.replaceChildren(
                            createElement(
                                "div",
                                "responsible-users-loading",
                                "CARREGANDO USUÁRIOS...",
                            ),
                        );
                    }
                }
            });

        try {
            const response = await fetch(
                "/api/inventario/responsaveis",
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                    },
                    cache: "no-store",
                },
            );

            const data =
                await response.json().catch(() => null);

            if (
                !response.ok ||
                !Array.isArray(data)
            ) {
                throw new Error(
                    data?.detail ||
                        "Não foi possível carregar os responsáveis.",
                );
            }

            users = data;
        } catch (error) {
            console.error(
                "Erro ao carregar responsáveis:",
                error,
            );

            users = [];

            document
                .querySelectorAll(".responsible-selector.is-open")
                .forEach((selector) => {
                    const list = selector.querySelector(
                        ".responsible-users-list",
                    );

                    if (list) {
                        list.replaceChildren(
                            createElement(
                                "div",
                                "responsible-users-error",
                                error.message ||
                                    "Não foi possível carregar os usuários.",
                            ),
                        );
                    }
                });
        } finally {
            loadingUsers = false;

            document
                .querySelectorAll(".responsible-selector.is-open")
                .forEach((selector) => {
                    const recordId = selector.dataset.recordId;

                    if (!recordId) {
                        return;
                    }

                    const searchInput =
                        selector.querySelector(
                            ".responsible-search-input",
                        );

                    const record = selector._responsibleRecord;

                    if (record) {
                        renderUserList(
                            selector,
                            record,
                            searchInput?.value || "",
                        );
                    }
                });
        }
    }

    function createResponsibleSelector(record) {
        const selector = createElement(
            "div",
            "responsible-selector",
        );

        selector.dataset.recordId = String(
            record.id || "",
        );

        selector._responsibleRecord = record;

        const hasSelectedResponsible =
            record.userName &&
            !isDefaultResponsible(record.userName);

        const button = document.createElement("button");

        button.type = "button";
        button.className =
            "main-action responsible-action";

        const content = createElement(
            "span",
            "responsible-action-content",
        );

        const icon = createElement(
            "span",
            "responsible-action-icon",
            "🧑",
        );

        const label = createElement(
            "span",
            "responsible-action-label",
            hasSelectedResponsible
                ? `RESPONSÁVEL: ${record.userName}`
                : "RESPONSÁVEL PELA SEPARAÇÃO",
        );

        const arrow = createElement(
            "span",
            "responsible-action-arrow",
            "▼",
        );

        content.append(
            icon,
            label,
            arrow,
        );

        button.append(content);

        button.setAttribute(
            "aria-expanded",
            "false",
        );

        button.setAttribute(
            "aria-label",
            hasSelectedResponsible
                ? `Responsável escolhido: ${record.userName}. Clique para alterar.`
                : "Selecionar responsável pela separação",
        );

        const panel = createElement(
            "div",
            "responsible-selector-panel",
        );

        const searchWrapper = createElement(
            "div",
            "responsible-search",
        );

        const searchIcon = createElement(
            "span",
            "responsible-search-icon",
            "⌕",
        );

        const searchInput = document.createElement("input");

        searchInput.type = "search";
        searchInput.className =
            "responsible-search-input";
        searchInput.placeholder =
            "Pesquisar responsável...";
        searchInput.autocomplete = "off";
        searchInput.setAttribute(
            "aria-label",
            "Pesquisar responsável",
        );

        searchWrapper.append(
            searchIcon,
            searchInput,
        );

        const list = createElement(
            "div",
            "responsible-users-list",
        );

        panel.append(
            searchWrapper,
            list,
        );

        selector.append(
            button,
            panel,
        );

        button.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();

                const isOpen =
                    selector.classList.contains(
                        "is-open",
                    );

                closeAllSelectors();

                if (isOpen) {
                    return;
                }

                selector.classList.add(
                    "is-open",
                );

                openSelector = selector;

                button.setAttribute(
                    "aria-expanded",
                    "true",
                );

                renderUserList(
                    selector,
                    record,
                    searchInput.value,
                );

                if (!users.length) {
                    loadUsers();
                }

                setTimeout(() => {
                    searchInput.focus();
                }, 0);
            },
        );

        searchInput.addEventListener(
            "input",
            () => {
                renderUserList(
                    selector,
                    record,
                    searchInput.value,
                );
            },
        );

        searchInput.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
            },
        );

        searchInput.addEventListener(
            "keydown",
            (event) => {
                if (event.key === "Escape") {
                    closeSelector(selector);
                }
            },
        );

        panel.addEventListener(
            "click",
            (event) => {
                event.stopPropagation();
            },
        );

        return selector;
    }

    function closeSelector(selector) {
        if (!selector) {
            return;
        }

        selector.classList.remove(
            "is-open",
        );

        const button =
            selector.querySelector(
                ".responsible-action",
            );

        if (button) {
            button.setAttribute(
                "aria-expanded",
                "false",
            );
        }

        if (openSelector === selector) {
            openSelector = null;
        }
    }

    async function assignResponsible(user, record) {
        if (
            !record ||
            !user ||
            window.AppInventory?.isActionInProgress()
        ) {
            return;
        }

        try {
            await window.AppInventory.runAction(
                async () => {
                    const response = await fetch(
                        `/api/inventario/pickings/${record.id}/responsavel`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                                Accept:
                                    "application/json",
                            },
                            body: JSON.stringify({
                                user_id: user.id,
                            }),
                        },
                    );

                    const data =
                        await response
                            .json()
                            .catch(() => ({}));

                    if (!response.ok) {
                        throw new Error(
                            data.detail ||
                                "Não foi possível definir o responsável.",
                        );
                    }

                    record.userId = user.id;
                    record.userName = user.name;

                    closeAllSelectors();

                    window.AppInventory.render();

                    window.AppInventory.showToast(
                        `RESPONSÁVEL DEFINIDO: ${user.name}`,
                    );
                },
            );
        } catch (error) {
            console.error(
                "Erro ao definir responsável:",
                error,
            );

            window.AppInventory.showToast(
                error.message ||
                    "Não foi possível definir o responsável.",
                "!",
            );
        }
    }

    function hasSelectedResponsible(record) {
        if (!record) {
            return false;
        }

        const hasUserId = Number(record.userId) > 0;
        const userIsDefaultResponsible = isDefaultResponsible(record.userName);

        return hasUserId && !userIsDefaultResponsible;
    }

    function canValidateResponsible(record) {
        return hasSelectedResponsible(record);
    }

    function enhanceCard(
        card,
        record,
        context,
    ) {
        const selector =
            createResponsibleSelector(record);

        const validationButton =
            context.primaryActions.querySelector(
                ".validation-action",
            );

        const qualityButton =
            context.primaryActions.querySelector(
                ".quality-action",
            );

        if (validationButton) {
            const canValidate = canValidateResponsible(record);
            validationButton.disabled = !canValidate;
            validationButton.title = canValidate
                ? "Validar separação"
                : "Selecione um responsável antes de validar.";
        }

        context.primaryActions.insertBefore(
            selector,
            context.primaryActions.firstChild,
        );

        if (
            qualityButton &&
            validationButton
        ) {
            context.primaryActions.insertBefore(
                qualityButton,
                validationButton,
            );
        }
    }

    function beforeValidate(record) {
        if (canValidateResponsible(record)) {
            return true;
        }

        window.AppInventory.showToast(
            "Selecione um responsável válido antes de validar a pré-separação.",
            "!",
        );
        return false;
    }

    function initialize() {
        if (initialized) {
            return;
        }

        initialized = true;

        if (!window.AppInventory) {
            console.error(
                "AppInventory não foi carregado.",
            );

            return;
        }

        // Estrutura para agrupar pickings por pedido_venda_id
        let pvGroups = [];

        function buildPVGroups(records) {
            const groupsById = new Map();

            for (const record of records || []) {
                // Usa estritamente pedido_venda_id como chave
                const pvId = record?.pedido_venda_id ?? null;
                const key = pvId === null ? "__NO_PV__" : String(pvId);

                if (!groupsById.has(key)) {
                    groupsById.set(key, {
                        pedido_venda_id: pvId,
                        pedido_venda_name: record?.pedido_venda_name || null,
                        pickings: [],
                    });
                }

                groupsById.get(key).pickings.push(record);
            }

            // Converter para array para uso simples
            pvGroups = Array.from(groupsById.values());

            // Expor globalmente para inspeção/uso por outras partes da UI (apenas leitura)
            try {
                window.PreSeparacaoPVGroups = pvGroups;
            } catch (e) {
                // Não crítico se não puder expor
                console.warn("Não foi possível expor PreSeparacaoPVGroups:", e);
            }
        }

        // Callback mínima para ser executada quando os registros forem substituídos
        function onRecordsReplaced(records) {
            buildPVGroups(records);

            // Depois que o render padrão criar os cards (síncrono),
            // moveremos os cards para dentro das caixas de PV.
            // Usar setTimeout 0 para executar depois do render() ocurrido.
            setTimeout(() => {
                try {
                    renderPVGroupsDOM();
                } catch (e) {
                    console.error('Erro ao renderizar grupos de PV:', e);
                }
            }, 0);
        }

        // Renderiza a estrutura visual dos grupos de PV e move os cards existentes
        function renderPVGroupsDOM() {
            const container = document.getElementById('pickingsContainer');
            if (!container) return;

            // Coleta os cards gerados pelo AppInventory (antes de esvaziar o container)
            const existingCards = Array.from(container.querySelectorAll('.picking-card'));

            // Limpa o container para inserir grupos (será re-populado com PV containers)
            container.replaceChildren();

            for (const group of pvGroups) {
                const pvCard = document.createElement('section');
                pvCard.className = 'pv-card';
                // identificar PV no DOM para atualizações dinâmicas
                const pvKey = group.pedido_venda_id === null ? '__NO_PV__' : String(group.pedido_venda_id);
                try { pvCard.dataset.pvId = pvKey; } catch (e) { /* non critical */ }


                // Header
                const header = document.createElement('div');
                header.className = 'pv-header';

                const left = document.createElement('div');
                left.className = 'pv-header-left';

                const toggleButton = document.createElement('button');
                toggleButton.type = 'button';
                toggleButton.className = 'pv-toggle';
                toggleButton.setAttribute('aria-expanded', 'false');
                toggleButton.textContent = '▶';

                const pvTitle = document.createElement('strong');
                pvTitle.className = 'pv-title';
                pvTitle.textContent = group.pedido_venda_name || (group.pedido_venda_id ? `PV ${group.pedido_venda_id}` : 'SEM PV');

                left.appendChild(toggleButton);
                left.appendChild(pvTitle);

                const right = document.createElement('div');
                right.className = 'pv-header-right';

                // Responsible button (reaproveita aparência)
                const responsibleButton = document.createElement('div');
                responsibleButton.className = 'pv-responsible-container';

                const responsibleAction = document.createElement('button');
                responsibleAction.type = 'button';
                responsibleAction.className = 'responsible-action';
                responsibleAction.textContent = 'SELECIONAR SEPARADOR';

                // Aba semelhante ao chat (usar mesmo estilo .chat-tab), contendo o contador
                const validatedCount = (group.pickings || []).filter(r => Boolean(r.validated)).length;
                const totalCount = (group.pickings || []).length;
                const pvChatTab = document.createElement('button');
                pvChatTab.type = 'button';
                pvChatTab.className = 'chat-tab pv-counter-tab';
                pvChatTab.setAttribute('aria-label', `Contador: ${validatedCount} de ${totalCount}`);
                pvChatTab.textContent = `${validatedCount}/${totalCount}`;
                // Não deve abrir chat — comportamento apenas visual aqui
                pvChatTab.addEventListener('click', (e) => { e.stopPropagation(); });

                responsibleButton.appendChild(responsibleAction);
                right.appendChild(responsibleButton);
                // pvChatTab appended last for alignment
                right.appendChild(pvChatTab);

                header.appendChild(left);
                header.appendChild(right);

                pvCard.appendChild(header);

                // Container onde os pickings serão colocados (inicialmente oculto)
                const pickingsList = document.createElement('div');
                pickingsList.className = 'pv-pickings hidden';

                // Mover os cards correspondentes a este grupo
                for (const picking of group.pickings) {
                    // Preferir localizar o card pelo dataset.recordId (adicionado em base.createCard)
                    const recordId = String(picking.id || picking.id === 0 ? picking.id : '');
                    let match = null;

                    if (recordId) {
                        match = existingCards.find((card) => String(card.dataset.recordId || '') === recordId);
                    }

                    // Fallback: ainda tentar por referência de texto (compatibilidade)
                    if (!match) {
                        match = existingCards.find((card) => {
                            const refEl = card.querySelector('.picking-identification strong');
                            if (!refEl) return false;
                            const text = (refEl.textContent || '').trim();
                            const candidate = String(picking.pv || picking.reference || '').trim();
                            return text === candidate;
                        });
                    }

                    if (match) {
                        // Remover aba de chat do card movido (na pré-separação o chat por picking não é exibido)
                        try {
                            const chatTab = match.querySelector('.chat-tab');
                            if (chatTab) chatTab.remove();
                        } catch (e) {
                            // ignore
                        }

                        pickingsList.appendChild(match);
                        // também remover do array para não reusar
                        const idx = existingCards.indexOf(match);
                        if (idx >= 0) existingCards.splice(idx, 1);
                    }
                }

                pvCard.appendChild(pickingsList);

                // Ações: toggle abrir/fechar
                toggleButton.addEventListener('click', () => {
                    const isOpen = !pickingsList.classList.contains('hidden');
                    if (isOpen) {
                        pickingsList.classList.add('hidden');
                        toggleButton.textContent = '▶';
                        toggleButton.setAttribute('aria-expanded', 'false');
                    } else {
                        pickingsList.classList.remove('hidden');
                        toggleButton.textContent = '▼';
                        toggleButton.setAttribute('aria-expanded', 'true');
                    }
                });

                // RESPONSÁVEL: abrir painel de seleção de usuário e atribuir a todos os pickings do grupo
                responsibleAction.addEventListener('click', (ev) => {
                    ev.stopPropagation();

                    // Se já existe um painel aberto, remover
                    const existing = pvCard.querySelector('.pv-responsible-panel');
                    if (existing) {
                        existing.remove();
                        return;
                    }

                    const panel = document.createElement('div');
                    panel.className = 'pv-responsible-panel';

                    const searchWrapper = document.createElement('div');
                    searchWrapper.className = 'responsible-search';
                    const searchIcon = document.createElement('span');
                    searchIcon.className = 'responsible-search-icon';
                    searchIcon.textContent = '⌕';
                    const searchInput = document.createElement('input');
                    searchInput.className = 'responsible-search-input';
                    searchInput.type = 'search';
                    searchInput.placeholder = 'Pesquisar responsável...';

                    searchWrapper.appendChild(searchIcon);
                    searchWrapper.appendChild(searchInput);

                    const list = document.createElement('div');
                    list.className = 'responsible-users-list';
                    list.textContent = 'CARREGANDO USUÁRIOS...';

                    panel.appendChild(searchWrapper);
                    panel.appendChild(list);

                    pvCard.appendChild(panel);

                    // carrega usuários (reaproveita loadUsers())
                    // loadUsers atualiza a variável users e também atualiza seletores abertos;
                    // aqui chamamos loadUsers para popular 'users' e depois renderizamos localmente
                    loadUsers().then(() => {
                        // render local list
                        if (!users || users.length === 0) {
                            list.textContent = 'Nenhum usuário ativo encontrado.';
                            return;
                        }

                        function renderFiltered(term) {
                            list.replaceChildren();
                            const filtered = users.filter(u => (u.name || '').toLowerCase().includes((term||'').toLowerCase()));
                            if (filtered.length === 0) {
                                const empty = document.createElement('div');
                                empty.className = 'responsible-users-empty';
                                empty.textContent = 'Nenhum usuário encontrado.';
                                list.appendChild(empty);
                                return;
                            }

                            for (const user of filtered) {
                                const btn = document.createElement('button');
                                btn.type = 'button';
                                btn.className = 'responsible-user-option';
                                const icon = document.createElement('span');
                                icon.className = 'responsible-user-icon';
                                icon.textContent = '◎';
                                const name = document.createElement('span');
                                name.className = 'responsible-user-name';
                                name.textContent = user.name || 'Usuário sem nome';
                                const check = document.createElement('span');
                                check.className = 'responsible-user-check';
                                check.textContent = '✓';
                                btn.appendChild(icon);
                                btn.appendChild(name);
                                btn.appendChild(check);

                                btn.addEventListener('click', async (ev) => {
                                    ev.stopPropagation();
                                    // Atribuir responsável para cada picking do grupo
                                    for (const p of group.pickings) {
                                        try {
                                            // Reutiliza assignResponsible existente
                                            // assignResponsible espera (user, record)
                                            // Aqui chamamos sequencialmente — cada chamada faz POST para /responsavel
                                            await assignResponsible(user, p);
                                        } catch (err) {
                                            console.error('Erro ao atribuir responsável a picking', p, err);
                                        }
                                    }

                                    // Fecha painel
                                    panel.remove();
                                });

                                list.appendChild(btn);
                            }
                        }

                        renderFiltered('');

                        searchInput.addEventListener('input', () => renderFiltered(searchInput.value));
                    }).catch((err) => {
                        console.error('Erro ao carregar usuários para painel PV:', err);
                        list.textContent = 'Erro ao carregar usuários.';
                    });
                });

                container.appendChild(pvCard);
            }

            // Se ainda existir cards não agrupados (por segurança), anexar ao container
            for (const leftover of existingCards) {
                container.appendChild(leftover);
            }
        }

        function updatePVCounters() {
            try {
                const records = window.AppInventory.getRecords ? window.AppInventory.getRecords() : [];
                const groupsById = new Map();
                for (const record of records || []) {
                    const pvId = record?.pedido_venda_id ?? null;
                    const key = pvId === null ? '__NO_PV__' : String(pvId);
                    if (!groupsById.has(key)) {
                        groupsById.set(key, { pickings: [] });
                    }
                    groupsById.get(key).pickings.push(record);
                }

                const container = document.getElementById('pickingsContainer');
                if (!container) return;

                for (const [key, group] of groupsById.entries()) {
                    const pvCard = container.querySelector(`.pv-card[data-pv-id="${key}"]`);
                    if (!pvCard) continue;
                    const validatedCount = (group.pickings || []).filter(r => Boolean(r.validated)).length;
                    const totalCount = (group.pickings || []).length;

                    // atualizar contador estrutural (caso exista)
                    const counterEl = pvCard.querySelector('.pv-counter');
                    if (counterEl) {
                        counterEl.textContent = `${validatedCount}/${totalCount}`;
                    }

                    // atualizar aba estilo chat que agora mostra o contador
                    const chatCounter = pvCard.querySelector('.chat-tab.pv-counter-tab');
                    if (chatCounter) {
                        chatCounter.textContent = `${validatedCount}/${totalCount}`;
                        chatCounter.setAttribute('aria-label', `Contador: ${validatedCount} de ${totalCount}`);
                    }
                }
            } catch (e) {
                console.error('Erro ao atualizar contadores de PV:', e);
            }
        }

        function handleAfterRender(records) {
            try {
                // Usar os registros atuais fornecidos pelo AppInventory
                buildPVGroups(window.AppInventory.getRecords ? window.AppInventory.getRecords() : []);
                // Reaplicar a estrutura visual dos PVs e pickings
                renderPVGroupsDOM();
                // Atualizar apenas os contadores
                updatePVCounters();
            } catch (e) {
                console.error('Erro ao processar onAfterRender (pre_separacao):', e);
            }
        }

        window.AppInventory.configure({
            enhanceCard,
            beforeValidate,
            onRecordsReplaced,
            onAfterRender: handleAfterRender,
        });

        // Fallback: caso o evento seja disparado diretamente
        document.addEventListener('appinventory:afterRender', (ev) => {
            try {
                handleAfterRender(ev?.detail?.records || []);
            } catch (e) {
                console.error('Erro no listener appinventory:afterRender (pre_separacao):', e);
            }
        });

        document.addEventListener(
            "click",
            () => {
                closeAllSelectors();
            },
        );
    }

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true,
            },
        );
    } else {
        initialize();
    }
}());