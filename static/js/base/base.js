(function () {
    "use strict";

    const themeStorageKey = document.body.dataset.themeStorageKey || "appTheme";

    function getElement(id) {
        return document.getElementById(id);
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

        applyTheme(localStorage.getItem(themeStorageKey) || "light");
        toggle.dataset.themeInitialized = "true";
        toggle.addEventListener("click", () => {
            const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
            applyTheme(nextTheme);
            localStorage.setItem(themeStorageKey, nextTheme);
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
        openModal,
        closeModal,
        showLoading,
        showToast,
    });

    initializeTheme();
    initializeModals();
}());
