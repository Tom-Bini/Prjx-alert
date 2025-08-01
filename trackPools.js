const API_URL = "https://api.goldsky.com/api/public/project_cmbbm2iwckb1b01t39xed236t/subgraphs/uniswap-v3-hyperevm-position/prod/gn";


async function fetchPoints(wallet) {
  const res = await fetch(``, {
    headers: {
      "Accept": "*/*",
      "Origin": "https://www.hybra.finance",
      "Referer": "https://www.hybra.finance/",
    },
  });

  if (!res.ok) {
    document.getElementById("points").textContent = "⚠️ Erreur lors du chargement des points";
    return;
  }

  const data = await res.json();
  const points = data?.data?.totalPoints ?? 0;

  // Ensuite fetch la diff locale
  try {
    const resDiff = await fetch(`/api/points-diff/${wallet}`);
    const diffData = await resDiff.json();

    const diff = diffData?.diff;
    const diffText = typeof diff === "number"
      ? ` (${diff >= 0 ? "+" : ""}${Math.round(diff).toLocaleString()})`
      : "";

    document.getElementById("points").textContent = `Points : ${points.toLocaleString()}${diffText}`;
  } catch (err) {
    document.getElementById("points").textContent = `Points : ${points.toLocaleString()} (diff. err)`;
  }
}

async function fetchAndDrawHistory(wallet) {
  console.log("⏳ fetchAndDrawHistory appelée avec : ", wallet);
  const res = await fetch(`/api/points-history/${wallet}`);
  const history = await res.json();

  const labels = history.map(entry => {
    const d = new Date(entry.timestamp);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
  });

  const data = history.map(entry => entry.points);

  const ctx = document.getElementById('pointsChart').getContext('2d');
  if (window.pointsChart && typeof window.pointsChart.destroy === 'function') {
    window.pointsChart.destroy();
  }


  window.pointsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Points',
        data,
        fill: false,
        borderColor: '#22C55E',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}

async function fetchAndDrawRankHistory(wallet) {
  const res = await fetch(`/api/rank-history/${wallet}`);
  const history = await res.json();

  const labels = history.map(entry => {
    const d = new Date(entry.timestamp);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
  });

  const data = history.map(entry => entry.rank);

  const ctx = document.getElementById('rankChart').getContext('2d');
  if (window.rankChart && typeof window.rankChart.destroy === 'function') {
    window.rankChart.destroy();
  }

  window.rankChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Rank',
        data,
        fill: false,
        borderColor: '#3B82F6',
        tension: 0.1
      }]
    },
    options: {
      scales: {
        y: {
          reverse: true, // car un meilleur rank = valeur plus basse
          beginAtZero: false
        }
      }
    }
  });
}


async function fetchPositions(wallet) {
  const payload = {
    query: `
      query getUserPositions($owner: Bytes!, $periodStart: Int!) {
        positions(where: {owner: $owner, liquidity_gt: "0"}) {
          id
          tickLower { tickIdx }
          tickUpper { tickIdx }
          pool {
            tick
            token0 { symbol }
            token1 { symbol }
          }
        }
      }
    `,
    variables: {
      owner: wallet.toLowerCase(),
      periodStart: 0 // pas utilisé ici, mais l’API l’attend dans la requête d’origine
    }
  };

  const headers = {
    "Content-Type": "application/json",
    "Origin": "https://www.prjx.com",
    "Referer": "https://www.prjx.com/"
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    console.error("Erreur API positions", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  return data.data?.positions || [];
}

function log(text) {
  document.getElementById("log").textContent += text + "\n";
}

function scheduleHourlyPointsUpdate(wallet) {
  async function fetchAndScheduleNext() {
    await fetchPoints(wallet);

    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours() + 1);
    next.setMinutes(16);
    next.setSeconds(0);
    next.setMilliseconds(0);

    const delay = next - now;
    setTimeout(fetchAndScheduleNext, delay);
  }

  fetchAndScheduleNext();
}

async function startMonitoring() {
  const mutedPositions = new Set();
  const wallet = document.getElementById("wallet").value.trim();
  scheduleHourlyPointsUpdate(wallet);
  fetchAndDrawHistory(wallet);
  fetchAndDrawRankHistory(wallet);
  const sound = document.getElementById("alertSound");

  if (!wallet) {
    alert("Entre une adresse de wallet");
    return;
  }

  setInterval(async () => {
    const positions = await fetchPositions(wallet);
    const now = new Date().toLocaleTimeString();
    const positionsContainer = document.getElementById("positions");
    positionsContainer.innerHTML = `<div style='font-weight:bold;margin-bottom:8px;'>Last update : ${now}</div>`;

    if (positions.length === 0) {
      positionsContainer.innerHTML += `<div class='no-position'>No position found</div>`;
      return;
    }

    for (const pos of positions) {
      const tickLower = parseInt(pos.tickLower.tickIdx);
      const tickUpper = parseInt(pos.tickUpper.tickIdx);
      const currentTick = parseInt(pos.pool.tick);
      const symbol0 = pos.pool.token0.symbol;
      const symbol1 = pos.pool.token1.symbol;
      const poolId = pos.id;
      const percentage = ((currentTick - tickLower) / (tickUpper - tickLower)) * 100;
      const inRange = currentTick >= tickLower && currentTick <= tickUpper;
      const warnNear = document.getElementById("warnNearRange").checked;
      const nearOut = percentage < 10 || percentage > 90;

      const card = document.createElement("div");
      card.className = "position-card" + (inRange ? " in-range" : " out-range");
      card.innerHTML = `
        <div class='pair'><b>${symbol0}/${symbol1}</b> <span class='pool-id'>(id: ${poolId})</span></div>
        <div>Range : <b>${tickLower}</b> → <b>${tickUpper}</b></div>
        <div>Current tick : <b>${currentTick}</b></div>
        <div class='status'>${inRange ? "✅ In range" : "🆘 Out of range"}</div>
        <div class="range-bar">
          <div class="segment red"></div>
          <div class="segment orange"></div>
          <div class="segment green"></div>
          <div class="segment orange"></div>
          <div class="segment red"></div>
          <div class="cursor" style="left: ${Math.max(0, Math.min(10 + (percentage * 0.8), 120))}%"></div>
        </div>
      `;
      card.className = "position-card" + (inRange ? " in-range" : " out-range");
      card.style.position = "relative"; // <--- IMPORTANT
      const positionLink = document.createElement("a");
      positionLink.href = "https://www.prjx.com/portfolio";
      positionLink.target = "_blank";
      positionLink.className = "position-btn";
      positionLink.textContent = "Position";
      positionLink.style.display = "inline-block";
      positionLink.style.marginTop = "5px";

      // Bouton Mute (en haut à droite)
      const muteButton = document.createElement("button");
      muteButton.className = "mute-btn";
      muteButton.style.position = "absolute";
      muteButton.style.bottom = "15px";
      muteButton.style.right = "20px";

      // Si la position est déjà dans mutedPositions → afficher rouge + icône mute
      if (mutedPositions.has(poolId)) {
        muteButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
        muteButton.style.backgroundColor = "#EF4444";
      } else {
        muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
        muteButton.style.backgroundColor = "#22C55E";
      }

      muteButton.onclick = () => {
        if (mutedPositions.has(poolId)) {
          mutedPositions.delete(poolId);
          muteButton.innerHTML = '<i class="fas fa-volume-up"></i>';
          muteButton.style.backgroundColor = "#22C55E";
        } else {
          mutedPositions.add(poolId);
          muteButton.innerHTML = '<i class="fas fa-volume-mute"></i>';
          muteButton.style.backgroundColor = "#EF4444";
        }
      };

      // Ajout dans la carte
      card.appendChild(muteButton);
      card.appendChild(positionLink);
      positionsContainer.appendChild(card);

      // Son si pas mute
      if (!mutedPositions.has(poolId) && (!inRange || (warnNear && nearOut))) {
        sound.play();
      }
    }
  }, 3000);
}
