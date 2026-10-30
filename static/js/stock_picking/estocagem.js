(function () {
    "use strict";
    // Modulo JS para a estocagem
    
    const inventory = window.AppInventory;
    if (!inventory) {
        console.error("O controlador compartilhado do inventario não foi carregado.");
        return;
    }

    inventory.configure({
        //Adicionar chamada de funções aqui
    });
}());