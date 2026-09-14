(function () {
    "use strict";

    const themeStorageKey = document.body.dataset.themeStorageKey || "appTheme";

    function getElement(id) {
        return document.getElementById(id);
    }

    function getStoredTheme() {
        try {
            return localStorage.getItem(themeStorageKey);
        } catch (error) {
            console.warn("Não foi possível ler a preferência de tema.", error);
            return null;
        }
    }

    function storeTheme(theme) {
        try {
            localStorage.setItem(themeStorageKey, theme);
        } catch (error) {
            console.warn("Não foi possível salvar a preferência de tema.", error);
        }
    }

    function applyTheme(theme) {
        const isDark = theme === "dark";
        const toggle = getElement("themeToggle");

        document.documentElement.dataset.theme = isDark ? "dark" : "light";

        if (!toggle) {
            return;
        }

        toggle.textContent = isDark ? "☀️" : "🌙";
        toggle.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo escuro");
        toggle.setAttribute("title", isDark ? "Ativar modo claro" : "Ativar modo escuro");
    }

    function initializeTheme() {
        const toggle = getElement("themeToggle");

        if (!toggle || toggle.dataset.themeInitialized === "true") {
            return;
        }

        const container = document.querySelector("[data-theme-toggle-container]");
        if (container) {
            container.append(toggle);
            toggle.classList.remove("global-theme-toggle");
        }

        applyTheme(getStoredTheme() || "light");
        toggle.dataset.themeInitialized = "true";
        toggle.addEventListener("click", () => {
            const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
            applyTheme(nextTheme);
            storeTheme(nextTheme);
        });
    }

    function showLoading() {
        const overlay = getElement("loadingOverlay");
        if (!overlay) {
            return;
        }
        overlay.classList.remove("hidden");
        overlay.setAttribute("aria-hidden", "false");
    }

    function hideLoading() {
        const overlay = getElement("loadingOverlay");
        if (!overlay) {
            return;
        }
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
    }

    let toastTimeout;
    function showToast(message, icon = "✓") {
        const toast = getElement("toast");
        const toastMessage = getElement("toastMessage");
        const toastIcon = getElement("toastIcon");
        if (!toast || !toastMessage || !toastIcon) {
            return;
        }
        toastMessage.textContent = message;
        toastIcon.textContent = icon;
        toast.classList.add("show");
        clearTimeout(toastTimeout);
        toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 2800);
    }

    function openModal(id) {
        getElement(id)?.classList.remove("hidden");
    }

    function closeModal(id) {
        const modal = getElement(id);
        if (!modal) {
            return;
        }
        document.dispatchEvent(new CustomEvent("app:modal-close", { detail: { id } }));
        modal.classList.add("hidden");
    }

    function initializeModals() {
        document.querySelectorAll("[data-close]").forEach((button) => {
            if (button.dataset.modalInitialized === "true") {
                return;
            }
            button.dataset.modalInitialized = "true";
            button.addEventListener("click", () => closeModal(button.dataset.close));
        });
        document.querySelectorAll(".modal-overlay").forEach((overlay) => {
            if (overlay.dataset.modalInitialized === "true") {
                return;
            }
            overlay.dataset.modalInitialized = "true";
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay && overlay.dataset.closeOnBackdrop !== "false") {
                    closeModal(overlay.id);
                }
            });
        });
    }

    function reloadCurrentPage() {
        const url = new URL(window.location.href);
        url.searchParams.set("_refresh", Date.now().toString());
        window.location.replace(url);
    }

    let pullRefreshHandler = reloadCurrentPage;
    let pullStartY = 0;
    let pullDistance = 0;
    let pullTracking = false;
    let pullRefreshing = false;
    let pullReady = false;
    const pullThreshold = 70;
    const pullMaxDistance = 150;

    function resetPullToRefresh() {
        const indicator = getElement("pullToRefresh");
        const icon = getElement("pullRefreshIcon");
        const text = getElement("pullRefreshText");

        pullTracking = false;
        pullReady = false;
        pullDistance = 0;
        indicator?.classList.remove("visible", "ready", "refreshing");
        indicator?.style.removeProperty("transform");
        if (icon) {
            icon.textContent = "↓";
        }
        if (text) {
            text.textContent = "Puxe para atualizar";
        }
    }

    async function refreshFromPull() {
        const indicator = getElement("pullToRefresh");
        const icon = getElement("pullRefreshIcon");
        const text = getElement("pullRefreshText");
        if (pullRefreshing) {
            return;
        }

        pullRefreshing = true;
        indicator?.classList.add("visible", "refreshing");
        indicator?.classList.remove("ready");
        indicator?.style.setProperty("transform", "translateY(0)");
        if (icon) {
            icon.textContent = "↻";
        }
        if (text) {
            text.textContent = "Atualizando...";
        }

        try {
            await pullRefreshHandler();
        } catch (error) {
            console.error("Erro ao atualizar a tela:", error);
            showToast(error.message || "Não foi possível atualizar a tela.", "!");
        } finally {
            window.setTimeout(() => {
                pullRefreshing = false;
                resetPullToRefresh();
            }, 300);
        }
    }

    function initializePullToRefresh() {
        const indicator = getElement("pullToRefresh");
        if (!indicator || indicator.dataset.pullInitialized === "true") {
            return;
        }

        indicator.dataset.pullInitialized = "true";
        document.addEventListener("touchstart", (event) => {
            if (
                pullRefreshing ||
                window.scrollY > 0 ||
                event.target.closest(".modal-overlay, input, textarea, select")
            ) {
                return;
            }
            pullStartY = event.touches[0].clientY;
            pullDistance = 0;
            pullTracking = true;
            pullReady = false;
        }, { passive: true });

        document.addEventListener("touchmove", (event) => {
            if (!pullTracking || pullRefreshing || document.documentElement.scrollTop > 1) {
                return;
            }

            const rawDistance = event.touches[0].clientY - pullStartY;
            if (rawDistance <= 0) {
                resetPullToRefresh();
                return;
            }

            pullDistance = Math.min(rawDistance * 0.55, pullMaxDistance);
            event.preventDefault();
            indicator.style.transform = `translateY(${pullDistance - indicator.offsetHeight}px)`;
            indicator.classList.add("visible");
            pullReady = pullDistance >= pullThreshold;
            indicator.classList.toggle("ready", pullReady);
            getElement("pullRefreshIcon").textContent = pullReady ? "↑" : "↓";
            getElement("pullRefreshText").textContent = pullReady ? "Solte para atualizar" : "Puxe para atualizar";
        }, { passive: false });

        document.addEventListener("touchend", () => {
            if (!pullTracking) {
                return;
            }
            pullTracking = false;
            if (pullReady) {
                refreshFromPull();
                return;
            }
            resetPullToRefresh();
        }, { passive: true });
        document.addEventListener("touchcancel", resetPullToRefresh, { passive: true });
    }

    function setPullToRefreshHandler(handler) {
        if (typeof handler !== "function") {
            throw new TypeError("A atualização por gesto deve ser uma função.");
        }
        pullRefreshHandler = handler;
    }

    function createBarcodeScanner({ video, onResult, onError }) {
        let controls = null;
        let reader = null;

        return {
            async start() {
                if (!window.ZXingBrowser?.BrowserMultiFormatReader) {
                    throw new Error("O leitor de código de barras não foi carregado.");
                }
                reader = new window.ZXingBrowser.BrowserMultiFormatReader();
                try {
                    controls = await reader.decodeFromConstraints(
                        { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
                        video,
                        onResult,
                    );
                } catch (error) {
                    onError?.(error);
                    throw error;
                }
            },
            stop() {
                controls?.stop();
                if (video?.srcObject) {
                    video.srcObject.getTracks().forEach((track) => track.stop());
                    video.srcObject = null;
                }
                controls = null;
                reader = null;
            },
        };
    }

    window.AppUI = Object.freeze({
        createBarcodeScanner,
        hideLoading,
        initializeModals,
        initializeTheme,
        initializePullToRefresh,
        openModal,
        closeModal,
        setPullToRefreshHandler,
        showLoading,
        showToast,
    });

    initializeTheme();
    initializeModals();
    initializePullToRefresh();
}());
