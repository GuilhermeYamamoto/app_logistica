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

        window.AppInventory.configure({
            enhanceCard,
            beforeValidate,
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