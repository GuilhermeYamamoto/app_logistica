const stageStatus = document.getElementById("stageStatus");
const stageRecordList = document.getElementById("stageRecordList");

function formatPartner(partner) {
    return Array.isArray(partner) ? partner[1] : "Sem parceiro";
}

async function loadStageRecords() {
    try {
        const response = await fetch(
            `/api/inventario/etapas/${encodeURIComponent(inventoryStage)}`
        );
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Não foi possível carregar os registros.");
        }

        if (data.records.length === 0) {
            stageStatus.textContent = data.message || "Nenhum registro pendente nesta etapa.";
            return;
        }

        stageStatus.textContent = `${data.records.length} registros pendentes.`;
        for (const record of data.records) {
            const item = document.createElement("li");
            const name = document.createElement("strong");
            const partner = document.createElement("span");
            const origin = document.createElement("span");

            name.textContent = record.name || "Sem referência";
            partner.textContent = formatPartner(record.partner_id);
            origin.textContent = record.origin || "Sem origem";

            item.append(name, partner, origin);
            stageRecordList.appendChild(item);
        }
    } catch (error) {
        stageStatus.textContent = error.message;
    }
}

loadStageRecords();
