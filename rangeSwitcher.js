let currentRangePercent = null;

function setRange(percent) {
    currentRangePercent = percent;
    updatePoolsTable();

    const label = document.getElementById("selectedRangeLabel");
    if (label) {
        if (percent === null) {
            label.textContent = "Ranking based on full TVL (no range filter)";
        } else {
            label.textContent = `Ranking based on TVL in ±${percent}% range`;
        }
    }
}

function getCurrentRangePercent() {
    return currentRangePercent;
}

document.getElementById("selectedRangeLabel").textContent = "Ranking based on full TVL (no range filter)";
