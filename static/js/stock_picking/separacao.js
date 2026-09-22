(function () {
    "use strict";
    // Modulo JS para a separacao
    
    const inventory = window.AppInventory;

    if (!inventory) {
        console.error("O controlador compartilhado do inventario não foi carregado.");
        return;
    }

    // *************************************************************************************
    // ***** Função para bloquear ações até que a embalagem seja validada corretamente *****
    // *************************************************************************************
    function bloquearCard(context, desbloquear = false) {
        // Botões principais:
        // VALIDAR
        // ALERTA DE QUALIDADE
        const botoesPrincipais = context.primaryActions.querySelectorAll("button");

        botoesPrincipais.forEach((botao) => {
            botao.disabled = !desbloquear;
        });

        // Botões secundários:
        // LER EMBALAGEM
        const botoesSecundarios =
            context.secondaryActions.querySelectorAll("button");

        botoesSecundarios.forEach((botao) => {
            if (botao.classList.contains("ler-embalagem-action")) {
                botao.disabled = false;
            } else {
                botao.disabled = !desbloquear;
            }
        });

        // Campo de quantidade
        const quantidade =
            context.main.querySelector(".quantity-input");

        if (quantidade) {
            quantidade.disabled = !desbloquear;
        }
    }
 
    // ******************************************************************************
    // ***** Validação da embalaem lida pelo scanner com a embalagem do picking *****
    // ******************************************************************************
    function validarEmbalagem(codigoLido, picking) {
        const codigo = String(codigoLido ?? "").trim();

        const embalagemEsperada = String(picking.resultPackageName ?? "").trim();

        if (!embalagemEsperada) {
            console.warn("O picking não possui embalagem definida.");
            return false;
        }

        return codigo === embalagemEsperada;
    }

    // *****************************************************
    // ***** Feedback Visual da validação da Embalagem *****
    // *****************************************************
    function mostrarResultadoValidacao(card, valido) {
        if (valido) {
            console.log("Embalagem Correta.");

            // Força o navegador a reconhecer a remoção da classe
            void card.offsetWidth;
            
            card.classList.add("embalagem-validada");
            
            inventory.showToast("Embalagem correta.", "✓");
            
            // *** Remove a classe de erro após 5 segundos para permitir nova tentativa ***
            setTimeout(() => {
                card.classList.remove("embalagem-invalida");
            }, 5000);

            return;
        } 

        // *** Embalagem incorreta ***
        console.warn("Embalagem Incorreta.");

        // Força o navegador a reconhecer a remoção da classe
        void card.offsetWidth;
        
        card.classList.add("embalagem-invalida");

        inventory.showToast("Embalagem incorreta.", "!");
        
        // *** Remove a classe de erro após 5 segundos para permitir nova tentativa ***
        setTimeout(() => {
            card.classList.remove("embalagem-invalida");
        }, 5000);
    }

    // *************************
    // *** Função do Scanner ***
    // *************************
    async function openBarcodeScanner(picking, onSuccess) {
        // *** Container do Scanner  -> Precisa do CSS funcionando para mostrar o container na tela ***
        const scannerContainer = document.createElement("div");
        scannerContainer.className = "barcode-scanner-container";

        // *** Video onde a camera sera exibida ***
        const video = document.createElement("video");
        video.className = "barcode-scanner-video";
        video.setAttribute("autoplay", "");
        video.setAttribute("muted", "");
        video.setAttribute("playsinline", "");

        // *** Botão de Fechar ***
        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "barcode-scanner-close";
        closeButton.textContent = "Fechar";

        // *** Monta o container ***
        scannerContainer.appendChild(video);
        scannerContainer.appendChild(closeButton);

        document.body.appendChild(scannerContainer);
        
        // ***********************************************
        // *** Cria o scanner herdando do base/base.js ***
        // ***********************************************
        const scanner = window.AppUI.createBarcodeScanner({
            video,
            onResult(result) {
                if (!result) {
                    return;
                }

                const codigoLido = String(result.text ??"").trim();

                console.log("Codigo de barras lido: ", codigoLido);
                console.log("Picking: ", picking);
                
                // *** Para o scanner assim que hover uma leitura ***
                scanner.stop();
                scannerContainer.remove();

                // *** Entrega o código lido para o picking que abriu o scanner ***
                if (onSuccess) {
                    onSuccess(codigoLido, picking);
                }
            },

            onError(error) {
                console.error("Erro ao ler código de barras: ", error);
            },
        });

        // *** Fecha o scanner manualmente ***
        closeButton.addEventListener("click", () => {
            scanner.stop();
            scannerContainer.remove();
        });
 
        // *** Inicia o scanner ***
        try {
            await scanner.start();
        } catch (error) {
            console.error("Não foi possível iniciar o scanner: ", error);

            scanner.stop();
            scannerContainer.remove();
        }
    }

    function enhanceCard(card, picking, context) {
        // Herda o Card base e adiciona funcionalidades específicas para a separacao
        
        // *********************
        // ***** Variaveis *****
        // *********************
        let embalagemValidada = false;


        // ***********************************************************
        // ***** Campos *****
        // ***********************************************************
        
        // *** Segunda linha de informações do card ***
        const secondaryInfoRow = document.createElement("div");
        secondaryInfoRow.className = "secondary-info-row";

        // *** Campo Local ***
        const localBox = document.createElement("div");
        localBox.className = "local-box";

        const localLabel = document.createElement("div");
        localLabel.className = "local-label";

        const localStyle = document.createElement("strong");
        localStyle.textContent = "Local";

        localLabel.appendChild(localStyle);

        const localValue = document.createElement("div");
        localValue.className = "local-value";
        localValue.textContent = picking.local && picking.local !== "CD/STO" ? picking.local : "Não definido";
        localBox.appendChild(localLabel);
        localBox.appendChild(localValue);

        // *** Campo Embalagem ***
        const resultPackageBox = document.createElement("div");
        resultPackageBox.className = "result-package-box";
        
        const resultPackageLabel = document.createElement("div");
        resultPackageLabel.className = "result-package-label";
        
        const resultPackageStyle = document.createElement("strong");
        resultPackageStyle.textContent = "Embalagem";
        
        resultPackageLabel.appendChild(resultPackageStyle);

        const resultPackageValue = document.createElement("div");
        resultPackageValue.className = "result-package-value";
        resultPackageValue.textContent = picking.resultPackageName || "Não definido";
        resultPackageBox.appendChild(resultPackageLabel);
        resultPackageBox.appendChild(resultPackageValue);

        // Adiciona os dois na mesma linha
        secondaryInfoRow.appendChild(localBox);
        secondaryInfoRow.appendChild(resultPackageBox);

        // Adiciona a segunda linha ao card
        context.main.appendChild(secondaryInfoRow);
        
        // **********************************
        // ***** Botões de ação do card *****
        // **********************************
        
        // *** Botão "Ler Embalagem" ao card ***
        const lerEmbalagemMaterial = document.createElement("button");
        
        lerEmbalagemMaterial.classList.add("main-action", "ler-embalagem-action");
        lerEmbalagemMaterial.innerHTML = '<span class="action-icon-small">▥</span>LER EMBALAGEM';
       
        lerEmbalagemMaterial.addEventListener("click", () => {
            openBarcodeScanner(
                picking,
                (codigoLido) => {
                    // *** Faz a validação da embalagem lida com a embalagem do picking ***
                    embalagemValidada = validarEmbalagem(codigoLido, picking);

                    // *** Mostra o resultado da validação no card ***
                    mostrarResultadoValidacao(card, embalagemValidada);

                    if (embalagemValidada) {
                        // *** Desbloqueia o card para permitir a edição de quantidade ***
                        bloquearCard(context, true);
                    }
                }
            );
        });

        context.addSecondaryAction(lerEmbalagemMaterial);

        bloquearCard(context, false); // Bloqueia o card inicialmente até que a embalagem seja validada
    }

    // Configura o módulo de inventário com a função enhanceCard e permite a edição de quantidade
    inventory.configure({
        canEditQuantity: true,
        enhanceCard,
    })
}());
