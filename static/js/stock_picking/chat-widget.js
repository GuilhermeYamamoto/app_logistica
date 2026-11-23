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
    let alertTimer = null;

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
        burst.getAnimations().forEach(function (animation) {
            animation.cancel();
        });

        chat.classList.remove("is-visible");
        chat.setAttribute("aria-hidden", "true");
        menu.classList.remove("is-hidden");
        root.classList.remove("is-chat");
        isChatVisible = false;
        isAnimating = false;
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
    }

    function resetRecipients(mode) {
        selectedRecipient = null;
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

        isAnimating = true;
        chat.classList.remove("is-visible");
        chat.setAttribute("aria-hidden", "true");
        menu.classList.remove("is-hidden");
        root.classList.remove("is-chat");

        window.setTimeout(function () {
            isChatVisible = false;
            isAnimating = false;
            tiles[0].focus({ preventScroll: true });
        }, GROW_DURATION);
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

    window.HelpWidget = {
        open: function () {
            setOpen(true);
        },
        close: function () {
            setOpen(false);
        },
    };
})();
