(function () {
    "use strict";

    // Mostra o carregamento global antes da navegação para uma etapa.
    // A página será substituída durante a navegação, por isso não é
    // necessário esconder o widget neste documento.
    function initializeStageNavigation() {
        document
            .querySelectorAll(".stage-card")
            .forEach((stageCard) => {
                stageCard.addEventListener("click", () => {
                    window.AppUI?.showLoading();
                });
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeStageNavigation,
            { once: true },
        );
    } else {
        initializeStageNavigation();
    }
}());
