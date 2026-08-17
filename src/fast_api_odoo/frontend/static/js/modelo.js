const statusElement = document.getElementById("modelStatus");
const recordList = document.getElementById("recordList");

async function loadRecords() {
    try {
        const response = await fetch(`/api/modelos/${encodeURIComponent(model)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Não foi possível carregar os registros.");
        }

        if (data.records.length === 0) {
            statusElement.textContent = "Nenhum registro encontrado.";
            return;
        }

        statusElement.textContent = `${data.records.length} registros encontrados.`;
        for (const record of data.records) {
            const item = document.createElement("li");
            item.textContent = record.display_name || `Registro #${record.id}`;
            recordList.appendChild(item);
        }
    } catch (error) {
        statusElement.textContent = error.message;
    }
}

loadRecords();
