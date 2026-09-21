(function () {
    "use strict";
    // Modulo JS para o recebimento fiscal
    
    const inventory = window.AppInventory;
    if (!inventory) {
        console.error("O controlador compartilhado do inventario não foi carregado.");
        return;
    }

    function enhanceCard(card, picking, context) {
        // Herda o Card base e adiciona funcionalidades específicas para o recebimento fiscal
            
        // Adiciona o botão "Definir Quantidade" ao card
        const definirQtdAction = document.createElement("button");
        definirQtdAction.classList.add("main-action");
        definirQtdAction.classList.add("definir-qtd-action");
        definirQtdAction.innerHTML = '<span class="action-icon-small">📦</span>DEFINIR QUANTIDADE';
        
        // Adiciona o evento de clique ao botão "Definir Quantidade"
        definirQtdAction.addEventListener("click", async () => {
            const expectedQuantity = context.main.querySelector(".expected-quantity");
            const quantityInput = context.main.querySelector(".quantity-input");

            if (!expectedQuantity || !quantityInput) {
                return;
            }
            
            // Extrai a quantidade esperada do texto do elemento
            const quantity = expectedQuantity.textContent.match(/[\d.,]+/)?.[0];
 
            // Atualiza o valor do input de quantidade e dispara os eventos de input e change
            setTimeout(() => {
                quantityInput.value = quantity;
                quantityInput.dispatchEvent(new Event("input", { bubbles: true }));
                quantityInput.dispatchEvent(new Event("change", { bubbles: true }));
            }, 100);   
        });

        context.addSecondaryAction(definirQtdAction);
    };

    // Configura o módulo de inventário com a função enhanceCard e permite a edição de quantidade
    inventory.configure({
        canEditQuantity: true,
        enhanceCard,
    })
}());
