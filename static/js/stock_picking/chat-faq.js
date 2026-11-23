/* =========================================================
   PERGUNTAS FREQUENTES DO CHAT DA IA — stock_picking
   Cada etapa tem 3 perguntas, cada uma com uma única resposta.
   As perguntas aparecem como caixinhas no chat da IA da etapa atual
   (chave em document.body.dataset.stageKey). O chat de T.I. não usa esta lista.
   Conteúdo sem integração: as respostas são fixas neste arquivo.
========================================================= */

window.HW_FAQ_BY_STAGE = {
    "recebimento-fiscal": [
        {
            question: "Como informo a quantidade recebida?",
            answer: "Clique em DEFINIR QUANTIDADE no card do picking. O sistema preenche a quantidade esperada, que você pode ajustar antes de validar.",
        },
        {
            question: "Por que não consigo validar um registro?",
            answer: "Porque é necessário informar uma quantidade recebida maior que zero antes de validar.",
        },
        {
            question: "Quando um registro fica EM ANDAMENTO?",
            answer: "Quando a quantidade recebida passa de 1 unidade. Ele continua na lista de pendentes até ser validado.",
        },
    ],

    "recebimento-qualidade": [
        {
            question: "Quantas fotos preciso registrar?",
            answer: "Normalmente 3 fotos. Para pickings com beneficiamento, o sistema pede 2.",
        },
        {
            question: "Como defino o local de destino?",
            answer: "Escolha o local pela leitura do código de barras ou pela seleção manual, e confirme a ação.",
        },
        {
            question: "Como finalizo o recebimento de qualidade?",
            answer: "Depois de registrar as fotos exigidas e definir o local, clique em validar e confirme na janela.",
        },
    ],

    "pre-separacao": [
        {
            question: "O que é verificado na pré-separação?",
            answer: "A embalagem. Leia o código de barras da embalagem e o sistema informa se ela está correta ou incorreta.",
        },
        {
            question: "Como defino o separador responsável?",
            answer: "Selecione o separador na lista de responsáveis do picking. O sistema confirma com a mensagem SEPARADOR DEFINIDO.",
        },
        {
            question: "Como faço a leitura do código de barras?",
            answer: "Use a leitura pela câmera e aponte para o código de barras dentro da área de leitura.",
        },
    ],

    "separacao": [
        {
            question: "Como replico o peso para os pacotes?",
            answer: "Informe o peso no campo Peso a ser replicado (kg) e confirme. O sistema aplica esse peso a todos os pacotes do picking.",
        },
        {
            question: "Como solicito a conferência da separação?",
            answer: "Clique em conferir separação e confirme. O picking segue para a etapa de Conferência Separação.",
        },
        {
            question: "O que faço se o peso estiver divergente?",
            answer: "Clique em solicitar correção do peso divergente e confirme a ação.",
        },
    ],

    "estocagem": [
        {
            question: "Como atualizo o peso de um picking?",
            answer: "Abra os detalhes do picking, informe o peso e confirme. O sistema mostra a mensagem Peso atualizado.",
        },
        {
            question: "Como solicito a correção de peso divergente?",
            answer: "Clique em solicitar correção do peso divergente no picking e confirme a ação.",
        },
        {
            question: "Como encontro um picking específico?",
            answer: "Use o campo de pesquisa no topo da tela e digite o número do PV ou o código do produto.",
        },
    ],

    "conferencia-separacao": [
        {
            question: "Como confirmo a conferência de um picking?",
            answer: "Clique para conferir o picking e confirme na janela. O picking é marcado como conferido.",
        },
        {
            question: "Como registro falta de material?",
            answer: "Abra o alerta de falta de material, preencha os dados da demanda e escolha a disposição da falta. Depois clique em abrir ticket.",
        },
        {
            question: "O que é a disposição da falta?",
            answer: "É a ação que o helpdesk deve tomar: abrir alerta de qualidade, liberar a quantidade faltante ou solicitar estoque.",
        },
    ],

    "empacotamento": [
        {
            question: "Como agrupo pickings em um pacote?",
            answer: "Marque os pickings desejados na lista, ou selecione todos, e clique em Gerar Pacote.",
        },
        {
            question: "Como finalizo o empacotamento?",
            answer: "Clique em Finalizar e confirme na janela Você tem certeza que deseja finalizar?.",
        },
        {
            question: "Como imprimo os pacotes?",
            answer: "Clique em Imprimir Pacotes. Os pacotes selecionados são enviados para impressão.",
        },
    ],

    "armazenamento-expedicao": [
        {
            question: "Como defino o local do picking?",
            answer: "Escolha o local pela leitura do código de barras do local ou pela seleção manual, e confirme.",
        },
        {
            question: "Como envio o picking para a conferência da expedição?",
            answer: "Depois de definir o local, clique em enviar para conferência. O sistema confirma com a mensagem Picking enviado para conferência com sucesso.",
        },
        {
            question: "O que faço se a câmera não lê o código do local?",
            answer: "Use a seleção manual: pesquise o local pelo nome e confirme.",
        },
    ],

    "conferencia-expedicao": [
        {
            question: "Como valido um pedido nesta etapa?",
            answer: "Abra o pedido e clique em validar. Confirme na janela que aparece.",
        },
        {
            question: "Preciso validar os pickings um a um?",
            answer: "Não. A validação é feita por pedido de venda, e todos os pickings do pedido são validados juntos.",
        },
        {
            question: "Como sei qual pedido está sendo validado?",
            answer: "A janela de confirmação mostra o número do pedido de venda.",
        },
    ],

    "faturamento": [
        {
            question: "Como encontro um PV nesta etapa?",
            answer: "Use o campo de pesquisa no topo da tela e digite o número do PV.",
        },
        {
            question: "Como vejo os pickings pendentes?",
            answer: "Use o card PENDENTES no topo da tela. O número mostra a quantidade de registros pendentes.",
        },
        {
            question: "Como vejo os pickings já iniciados?",
            answer: "Use o card EM ANDAMENTO no topo da tela, que mostra os registros que já foram iniciados.",
        },
    ],

    "entrega-retira": [
        {
            question: "Como registro o canhoto da NF?",
            answer: "Abra o batch e adicione a foto do canhoto no registro fotográfico.",
        },
        {
            question: "Como confirmo a entrega?",
            answer: "Com o canhoto registrado, clique em validar entrega, aprove a foto e confirme na janela.",
        },
        {
            question: "Como removo uma foto errada?",
            answer: "Remova a foto pelo registro fotográfico e adicione outra no lugar.",
        },
    ],
};
