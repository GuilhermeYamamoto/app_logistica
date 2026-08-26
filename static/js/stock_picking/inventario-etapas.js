const stageStatus = document.getElementById("stageStatus");
const stageRecordList = document.getElementById("stageRecordList");

async function loadStageRecords() {
    try {
        if (inventoryStageRecords.length === 0) {
            stageStatus.textContent = "Nenhum registro pendente nesta etapa.";
            return;
        }

        stageStatus.textContent = `${inventoryStageRecords.length} registros pendentes.`;
        for (const record of inventoryStageRecords) {
            const item = document.createElement("li");
            const name = document.createElement("strong");
            const partner = document.createElement("span");
            const origin = document.createElement("span");

            name.textContent = record.reference || "Sem referência";
            partner.textContent = record.client || "Sem fornecedor";
            origin.textContent = record.product || "Sem produtos";

            item.append(name, partner, origin);
            stageRecordList.appendChild(item);
        }
    } catch (error) {
        stageStatus.textContent = error.message;
    }
}

loadStageRecords();
