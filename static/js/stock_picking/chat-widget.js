/* =========================================================
   WIDGET DE AUXÍLIO (CHATBOT) — stock_picking/base
   - Widget quadrado no canto inferior direito.
   - Ao clicar, o widget vira um retângulo pequeno com os quadradinhos IA e T.I.
   - Ao escolher uma opção, o chat nasce do quadrado clicado e o widget
     cresce até virar o chat.
   - Ainda SEM integração: o envio usa uma resposta simulada.
     Quando o backend do chatbot estiver definido, troque apenas
     a função `requestReply`.
========================================================= */

(function () {
    "use strict";

    const root = document.getElementById("helpWidget");

    if (!root) {
        return;
    }

    const launcher = document.getElementById("helpWidgetLauncher");
    const panel = document.getElementById("helpWidgetPanel");
    const menu = document.getElementById("helpWidgetMenu");
    const tiles = document.querySelectorAll("[data-hw-mode]");
    const burst = document.getElementById("helpWidgetBurst");
    const chat = document.getElementById("helpWidgetChat");
    const chatTitle = document.getElementById("helpWidgetChatTitle");
    const backButton = document.getElementById("helpWidgetBack");
    const closeButton = document.getElementById("helpWidgetClose");
    const messages = document.getElementById("helpWidgetMessages");
    const recipientsBox = document.getElementById("helpWidgetRecipients");
    const recipientButtons = document.querySelectorAll("[data-hw-recipient]");
    const alertBox = document.getElementById("helpWidgetAlert");
    const form = document.getElementById("helpWidgetForm");
    const input = document.getElementById("helpWidgetInput");
    const sendButton = document.getElementById("helpWidgetSend");

    const MAX_INPUT_HEIGHT = 120;
    const PANEL_RADIUS = 26;
    const OPEN_DURATION = 520;
    const BURST_DURATION = 380;
    const GROW_DURATION = 500; // deve acompanhar a transição de width/height no CSS
    const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

    /* Conteúdo de cada canal. Os textos podem ser ajustados sem mexer na lógica. */
    const MODES = {
        ia: {
            title: "Assistente de IA",
            welcome: "Olá! Como posso ajudar?",
            // Mostra as perguntas frequentes da etapa atual (ver chat-faq.js).
            faq: true,
        },
        ti: {
            title: "Suporte de T.I.",
            welcome: "Olá! Em que posso ajudar com o sistema?",
            // O chat de T.I. não mostra perguntas frequentes.
            faq: false,
        },
    };

    let isOpen = false;
    let isBusy = false;
    let isAnimating = false;
    let isChatVisible = false;
    let currentMode = null;
    let selectedRecipient = null;
    let currentRecipientName = null;
    let historyTimer = null;
    let historyController = null;
    let historyLoadingForced = false;
    let lastHistoryKey = null;

    const CHAT_API = "/api/chat";
    const HISTORY_INTERVAL_MS = 5000;
    const SEEN_STORAGE_KEY = "hwChatSeen";
    let alertTimer = null;

    const badge = document.getElementById("helpWidgetBadge");
    // Último ID lido de cada pessoa (por usuário do navegador).
    let seenIds = loadSeen();
    let unreadTotal = 0;
    // Não lidas por pessoa (chave em minúsculas, como no backend).
    let unreadByPerson = {};
    let summaryBusy = false;

    /* ---------- Integração (ponto de extensão) ---------- */

    /**
     * Ponto único de integração com o chatbot.
     * Hoje apenas simula uma resposta; no futuro deve enviar `text`
     * ao backend e retornar o texto da resposta.
     */
    function requestReply(text) {
        return new Promise(function (resolve) {
            window.setTimeout(function () {
                resolve(
                    "Recebi sua mensagem: “" + text + "”.\n\n" +
                    "A integração com o assistente ainda não está ativa nesta tela."
                );
            }, 900);
        });
    }

    /* ---------- Abrir / fechar o widget ---------- */

    function setOpen(open) {
        if (isOpen === open) {
            return;
        }

        isOpen = open;
        root.classList.toggle("is-open", open);
        launcher.setAttribute("aria-expanded", String(open));
        launcher.setAttribute("aria-label", open ? "Assistente aberto" : "Abrir assistente");
        panel.setAttribute("aria-hidden", String(!open));

        if (open) {
            window.setTimeout(function () {
                if (isOpen && !isChatVisible) {
                    tiles[0].focus({ preventScroll: true });
                }
            }, OPEN_DURATION);
        } else {
            resetToMenu();
            launcher.focus({ preventScroll: true });
        }
    }

    /* Volta ao estado inicial, sem animação (usado ao fechar o widget). */
    function resetToMenu() {
        stopTiHistory();
        burst.getAnimations().forEach(function (animation) {
            animation.cancel();
        });

        chat.classList.remove("is-visible");
        chat.setAttribute("aria-hidden", "true");
        menu.classList.remove("is-hidden");
        root.classList.remove("is-chat");
        isChatVisible = false;
        isAnimating = false;
        renderBadge();
    }

    /* ---------- Animações ---------- */

    /**
     * Calcula a transformação que leva um elemento de tamanho real (o `target`,
     * que ocupa todo o painel) para o tamanho e a posição do quadrado clicado.
     */
    function getTransformFromTile(tile, target) {
        const tileRect = tile.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const tileRadius = parseFloat(window.getComputedStyle(tile).borderTopLeftRadius) || 0;

        const scaleX = tileRect.width / targetRect.width;
        const scaleY = tileRect.height / targetRect.height;
        const offsetX = tileRect.left - targetRect.left;
        const offsetY = tileRect.top - targetRect.top;

        return {
            transform: "translate(" + offsetX + "px, " + offsetY + "px) scale(" + scaleX + ", " + scaleY + ")",
            // O raio é compensado pela escala para que o canto visual continue igual ao do quadrado.
            radius: (tileRadius / scaleX) + "px / " + (tileRadius / scaleY) + "px",
        };
    }

    /* Perguntas frequentes da etapa atual (definidas em chat-faq.js). */
    function getStageFaqs() {
        const stageKey = document.body.dataset.stageKey || "";
        const faqByStage = window.HW_FAQ_BY_STAGE || {};

        return faqByStage[stageKey] || [];
    }

    /* Responde a pergunta frequente localmente, sem chamar o backend. */
    function answerFaq(item) {
        if (isBusy) {
            return;
        }

        removeWelcome();
        addMessage(item.question, "user");
        setBusy(true);

        const typing = showTyping();

        window.setTimeout(function () {
            typing.remove();
            addMessage(item.answer, "bot");
            setBusy(false);
            input.focus({ preventScroll: true });
        }, 500);
    }

    function renderWelcome(mode) {
        const config = MODES[mode];
        const box = document.createElement("div");
        const head = document.createElement("div");
        const title = document.createElement("h3");
        const text = document.createElement("p");
        const chipList = document.createElement("div");

        box.className = "hw-welcome";
        title.className = "hw-welcome-title";
        title.textContent = config.welcome;
        text.className = "hw-welcome-text";
        text.textContent = "Escolha uma sugestão ou escreva sua dúvida abaixo.";
        chipList.className = "hw-chips";

        if (config.faq) {
            getStageFaqs().forEach(function (item) {
                const chip = document.createElement("button");
                chip.className = "hw-chip";
                chip.type = "button";
                chip.textContent = item.question;
                chip.addEventListener("click", function () {
                    answerFaq(item);
                });
                chipList.appendChild(chip);
            });
        }

        head.append(title, text);
        box.append(head, chipList);
        messages.appendChild(box);
    }

    /* ---------- Destinatário (somente T.I.) ---------- */

    function selectRecipient(name) {
        selectedRecipient = name;
        currentRecipientName = name;

        recipientButtons.forEach(function (button) {
            const active = button.getAttribute("data-hw-recipient") === name;
            button.classList.toggle("is-selected", active);
            button.setAttribute("aria-checked", String(active));
        });

        // No T.I., o nome do assistente passa a ser o da pessoa selecionada.
        if (currentMode === "ti") {
            chatTitle.textContent = name;
        }

        // Enquanto a saudação do T.I. estiver visível, ela passa a indicar com quem o usuário está falando.
        const welcomeTitle = messages.querySelector(".hw-welcome-title");

        if (currentMode === "ti" && welcomeTitle) {
            welcomeTitle.textContent = "Você está falando com o " + name;
        }

        hideRecipientAlert();

        if (currentMode === "ti") {
            startTiHistory();
        }
    }

    function resetRecipients(mode) {
        selectedRecipient = null;
        currentRecipientName = null;
        stopTiHistory();
        chatTitle.textContent = "Assistente";
        recipientButtons.forEach(function (button) {
            button.classList.remove("is-selected");
            button.setAttribute("aria-checked", "false");
        });
        recipientsBox.hidden = mode !== "ti";
        hideRecipientAlert();
    }

    function hideRecipientAlert() {
        window.clearTimeout(alertTimer);
        alertBox.classList.remove("is-visible");
    }

    /* Mostra o aviso sobreposto e chama atenção para as opções logo abaixo. */
    function showRecipientAlert() {
        window.clearTimeout(alertTimer);
        alertBox.classList.add("is-visible");

        recipientsBox.classList.remove("is-attention");
        // Reinicia a animação caso já tenha sido executada.
        void recipientsBox.offsetWidth;
        recipientsBox.classList.add("is-attention");

        alertTimer = window.setTimeout(hideRecipientAlert, 3200);
    }

    /* Opção clicada: o quadrado cresce até preencher o retângulo, depois o widget vira o chat. */
    function openChat(mode) {
        if (isAnimating || isChatVisible || !MODES[mode]) {
            return;
        }

        const tile = document.querySelector('[data-hw-mode="' + mode + '"]');
        const from = getTransformFromTile(tile, burst);

        currentMode = mode;
        resetRecipients(mode);
        messages.replaceChildren();
        renderWelcome(mode);
        input.value = "";
        resizeInput();

        isAnimating = true;

        const animation = burst.animate(
            [
                { transform: from.transform, borderRadius: from.radius, opacity: 1 },
                { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: PANEL_RADIUS + "px / " + PANEL_RADIUS + "px", opacity: 1 },
            ],
            { duration: BURST_DURATION, easing: EASE_OUT, fill: "forwards" }
        );

        animation.finished.then(function () {
            // Agora o widget cresce para o tamanho do chat; o chat aparece por cima do gradiente.
            menu.classList.add("is-hidden");
            root.classList.add("is-chat");
            chat.classList.add("is-visible");
            chat.setAttribute("aria-hidden", "false");

            window.setTimeout(function () {
                burst.getAnimations().forEach(function (item) {
                    item.cancel();
                });
                isChatVisible = true;
                isAnimating = false;
                renderBadge();
                input.focus({ preventScroll: true });
            }, GROW_DURATION);
        }).catch(function () {
            isAnimating = false;
        });
    }

    /* Botão voltar: o chat some e o widget encolhe de volta para o retângulo das opções. */
    function closeChat() {
        if (isAnimating || !isChatVisible) {
            return;
        }

        stopTiHistory();
        isAnimating = true;
        chat.classList.remove("is-visible");
        chat.setAttribute("aria-hidden", "true");
        menu.classList.remove("is-hidden");
        root.classList.remove("is-chat");

        window.setTimeout(function () {
            isChatVisible = false;
            isAnimating = false;
            renderBadge();
            tiles[0].focus({ preventScroll: true });
        }, GROW_DURATION);
    }

    /* ---------- Chat privado com a equipe de T.I. (Odoo) ---------- */

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {}),
            },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || "Não foi possível concluir a ação.");
        }

        return data;
    }

    function applyWelcomeTitle() {
        const title = messages.querySelector(".hw-welcome-title");

        if (title && currentRecipientName) {
            title.textContent = "Você está falando com o " + currentRecipientName;
        }
    }

    function appendHistoryMessage(item) {
        const bubble = document.createElement("div");
        bubble.className = "hw-msg " + (item.eu ? "hw-msg-user" : "hw-msg-bot");

        if (!item.eu && item.autor) {
            const author = document.createElement("span");
            author.className = "hw-msg-author";
            author.textContent = item.autor;
            bubble.appendChild(author);
        }

        bubble.appendChild(document.createTextNode(item.texto));
        messages.appendChild(bubble);
        scrollToBottom();
    }

    /* Indicador de carregamento no meio do chat, enquanto o histórico é buscado. */
    function showHistoryLoading() {
        historyLoadingForced = true;

        const loader = document.createElement("div");
        loader.className = "hw-loading";
        loader.setAttribute("role", "status");
        loader.innerHTML = '<span class="hw-spinner" aria-hidden="true"></span><span>Carregando mensagens...</span>';
        messages.replaceChildren(loader);
    }

    function currentHistoryKey() {
        return selectedRecipient ? selectedRecipient.toLowerCase() : null;
    }

    /*
     * Carrega as mensagens de hoje com a pessoa selecionada.
     * - showLoading: troca de pessoa; mostra o carregamento e sempre renderiza o resultado.
     * - sem showLoading: atualização periódica; só redesenha se houver mudança.
     * Cada chamada cancela a anterior, para que a resposta de uma pessoa nunca apareça na conversa de outra.
     */
    async function loadTiHistory({ showLoading = false } = {}) {
        const key = currentHistoryKey();

        if (!key || currentMode !== "ti" || isBusy) {
            return;
        }

        // Uma atualização periódica não interrompe o carregamento de uma troca de pessoa.
        if (!showLoading && historyLoadingForced) {
            return;
        }

        historyController?.abort();
        const controller = new AbortController();
        historyController = controller;

        if (showLoading) {
            showHistoryLoading();
        }

        try {
            const data = await apiRequest(`${CHAT_API}/conversas/${key}`, { signal: controller.signal });

            if (controller.signal.aborted || key !== currentHistoryKey()) {
                return;
            }

            const historyKey = data.mensagens.map((item) => item.id).join(",");

            if (!showLoading && historyKey === lastHistoryKey) {
                return;
            }

            lastHistoryKey = historyKey;
            messages.replaceChildren();

            if (data.mensagens.length === 0) {
                renderWelcome("ti");
                applyWelcomeTitle();
                return;
            }

            data.mensagens.forEach(appendHistoryMessage);
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            // Falha na atualização em segundo plano: mantém o que já está na tela.
            if (showLoading && key === currentHistoryKey()) {
                messages.replaceChildren();
                renderWelcome("ti");
                applyWelcomeTitle();
            }
        } finally {
            if (historyController === controller) {
                historyController = null;
                historyLoadingForced = false;
            }
        }
    }

    function startTiHistory() {
        stopTiHistory();
        lastHistoryKey = null;
        loadTiHistory({ showLoading: true });

        historyTimer = window.setInterval(function () {
            if (!document.hidden) {
                loadTiHistory();
            }
        }, HISTORY_INTERVAL_MS);
    }

    function stopTiHistory() {
        window.clearInterval(historyTimer);
        historyTimer = null;
        historyController?.abort();
        historyController = null;
        historyLoadingForced = false;
    }

    async function sendTiMessage(text) {
        removeWelcome();
        input.value = "";
        resizeInput();
        setBusy(true);

        const typing = showTyping();

        try {
            const data = await apiRequest(
                `${CHAT_API}/conversas/${selectedRecipient.toLowerCase()}/mensagens`,
                { method: "POST", body: JSON.stringify({ texto: text }) },
            );
            typing.remove();
            appendHistoryMessage({ ...data, autor: "", eu: true });
            lastHistoryKey = null;
        } catch (error) {
            typing.remove();
            addMessage(error.message || "Não foi possível enviar a mensagem.", "bot");
        } finally {
            setBusy(false);
            input.focus({ preventScroll: true });
        }
    }

    /* ---------- Mensagens ---------- */

    function scrollToBottom() {
        messages.scrollTop = messages.scrollHeight;
    }

    function removeWelcome() {
        const welcome = messages.querySelector(".hw-welcome");

        if (welcome) {
            welcome.remove();
        }
    }

    function addMessage(text, author) {
        const item = document.createElement("div");
        item.className = "hw-msg " + (author === "user" ? "hw-msg-user" : "hw-msg-bot");
        item.textContent = text;
        messages.appendChild(item);
        scrollToBottom();
        return item;
    }

    function showTyping() {
        const indicator = document.createElement("div");
        indicator.className = "hw-typing";
        indicator.setAttribute("aria-label", "Assistente está respondendo");
        indicator.innerHTML = "<span></span><span></span><span></span>";
        messages.appendChild(indicator);
        scrollToBottom();
        return indicator;
    }

    function setBusy(busy) {
        isBusy = busy;
        sendButton.disabled = busy || !input.value.trim();
        input.disabled = busy;
    }

    async function sendMessage(rawText) {
        const text = (rawText || "").trim();

        if (!text || isBusy) {
            return;
        }

        if (currentMode === "ti" && !selectedRecipient) {
            showRecipientAlert();
            return;
        }

        if (currentMode === "ti") {
            await sendTiMessage(text);
            return;
        }

        removeWelcome();
        addMessage(text, "user");

        input.value = "";
        resizeInput();
        setBusy(true);

        const typing = showTyping();

        try {
            const reply = await requestReply(text);
            typing.remove();
            addMessage(reply, "bot");
        } catch (error) {
            typing.remove();
            addMessage("Não foi possível obter a resposta. Tente novamente.", "bot");
        } finally {
            setBusy(false);
            input.focus({ preventScroll: true });
        }
    }

    /* ---------- Campo de texto ---------- */

    function resizeInput() {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, MAX_INPUT_HEIGHT) + "px";
        sendButton.disabled = isBusy || !input.value.trim();
    }

    /* ---------- Mensagens não lidas (aviso no widget fechado) ---------- */

    function loadSeen() {
        try {
            return JSON.parse(window.localStorage.getItem(SEEN_STORAGE_KEY)) || {};
        } catch (error) {
            return {};
        }
    }

    function saveSeen() {
        try {
            window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seenIds));
        } catch (error) {
            // Sem armazenamento disponível, o controle vale só enquanto a página estiver aberta.
        }
    }

    /* Contador vermelho sobre o widget. Some com o chat aberto. */
    function renderBadge() {
        const show = unreadTotal > 0 && !isChatVisible;

        badge.hidden = !show;
        badge.textContent = unreadTotal > 99 ? "99+" : String(unreadTotal);
    }

    /* Contador vermelho dentro da caixa de cada pessoa do T.I. */
    function renderRecipientBadges() {
        recipientButtons.forEach(function (button) {
            const key = button.getAttribute("data-hw-recipient").toLowerCase();
            const count = unreadByPerson[key] || 0;
            const counter = button.querySelector(".hw-recipient-badge");

            if (!counter) {
                return;
            }

            counter.hidden = count === 0;
            counter.textContent = count > 99 ? "99+" : String(count);
        });
    }

    /* Tremida leve do widget quando chega mensagem nova. */
    function shakeLauncher() {
        launcher.classList.remove("is-shaking");
        void launcher.offsetWidth;
        launcher.classList.add("is-shaking");
        launcher.addEventListener("animationend", function () {
            launcher.classList.remove("is-shaking");
        }, { once: true });
    }

    /*
     * Consulta as mensagens recebidas de hoje e conta as que ainda não foram lidas.
     * Lido = a conversa com a pessoa estava aberta, ou a mensagem já existia antes
     * do widget começar a acompanhar a conversa.
     */
    async function loadSummary() {
        if (document.hidden || summaryBusy) {
            return;
        }

        summaryBusy = true;

        try {
            const data = await apiRequest(`${CHAT_API}/resumo`);
            const pessoas = data.pessoas || {};
            const viewingKey = isChatVisible && currentMode === "ti" ? currentHistoryKey() : null;
            const previousTotal = unreadTotal;
            let changed = false;
            let total = 0;
            unreadByPerson = {};

            Object.keys(pessoas).forEach(function (key) {
                const ids = pessoas[key].recebidas || [];
                const maxId = ids.reduce(function (max, id) {
                    return Math.max(max, id);
                }, 0);

                // Primeira vez que a pessoa aparece: o que já existe conta como lido.
                if (!(key in seenIds)) {
                    seenIds[key] = maxId;
                    changed = true;
                }

                // Conversa aberta na tela: tudo que chegou fica como lido.
                if (key === viewingKey && maxId > seenIds[key]) {
                    seenIds[key] = maxId;
                    changed = true;
                }

                const count = ids.filter(function (id) {
                    return id > seenIds[key];
                }).length;

                unreadByPerson[key] = count;
                total += count;
            });

            if (changed) {
                saveSeen();
            }

            unreadTotal = total;
            renderBadge();
            renderRecipientBadges();

            if (total > previousTotal && !isChatVisible) {
                shakeLauncher();
            }
        } catch (error) {
            // Falha silenciosa: o aviso tenta de novo na próxima consulta.
        } finally {
            summaryBusy = false;
        }
    }

    /* ---------- Eventos ---------- */

    launcher.addEventListener("click", function () {
        setOpen(true);
    });

    tiles.forEach(function (tile) {
        tile.addEventListener("click", function () {
            openChat(tile.getAttribute("data-hw-mode"));
        });
    });

    recipientButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            selectRecipient(button.getAttribute("data-hw-recipient"));
        });
    });

    backButton.addEventListener("click", function () {
        closeChat();
    });

    closeButton.addEventListener("click", function () {
        setOpen(false);
    });

    // Clicar fora do retângulo de opções fecha o widget (o chat só fecha pelo botão ×).
    document.addEventListener("pointerdown", function (event) {
        if (isOpen && !isChatVisible && !isAnimating && !root.contains(event.target)) {
            setOpen(false);
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && isOpen) {
            setOpen(false);
        }
    });

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        sendMessage(input.value);
    });

    input.addEventListener("input", resizeInput);

    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    sendButton.disabled = true;

    renderBadge();
    renderRecipientBadges();
    loadSummary();
    window.setInterval(loadSummary, HISTORY_INTERVAL_MS);

    window.HelpWidget = {
        open: function () {
            setOpen(true);
        },
        close: function () {
            setOpen(false);
        },
    };
})();
