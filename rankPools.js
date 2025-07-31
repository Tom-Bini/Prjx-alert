async function updatePoolsTable() {
    console.log("⏳ updatePoolsTable called...");
    const rangePercent = getCurrentRangePercent();

    const graphQLEndpoint = "https://api.goldsky.com/api/public/project_cmbbm2iwckb1b01t39xed236t/subgraphs/uniswap-v3-hyperevm-position/prod/gn";
    const pointsEndpoint = "https://server.hybra.finance/api/points/pool-config/getAllPoolConfigs";

    const graphQLPayload = {
        operationName: "ConsolidatedPoolsData",
        variables: {
            tvl: "0",
            vol: "0",
            first: 1000,
            skip: 0,
            orderBy: "totalValueLockedUSD",
            orderDirection: "desc",
            periodStart: Math.floor(Date.now() / 1000) - 86400,  // hier par défaut
            blockedTokens: [
                "0x729655088da8624c1004bf2705e3a3eeebdf0d6d",
                "0xb07f5e05d67dfbd6ea2300c8f788c1365b44a834"
            ]
        },
        query: `
      query GetV3Pools($first: Int!, $skip: Int!, $where: Pool_filter, $orderBy: String!, $orderDirection: String!) {
        pools(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: $orderDirection) {
          id
          token0 { symbol id }
          token1 { symbol id }
          feeTier
          totalValueLockedUSD
          tick
          sqrtPrice
          ticks(first: 1000) {
            tickIdx
            liquidityGross
            liquidityNet
          }
        }
      }
    `
    };


    // Helpers
    const getPriceFromSqrtPriceX96 = (sqrtX96) => {
        return (parseFloat(sqrtX96) / (2 ** 96)) ** 2;
    };

    const getTickFromPrice = (price) => {
        return Math.floor(Math.log(price) / Math.log(1.0001));
    };

    const [res1, res2] = await Promise.all([
        fetch(graphQLEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Origin": "https://www.hybra.finance",
                "Referer": "https://www.hybra.finance/"
            },
            body: JSON.stringify(graphQLPayload)
        }),
        fetch(pointsEndpoint, {
            headers: {
                "Accept": "application/json",
                "Origin": "https://www.hybra.finance",
                "Referer": "https://www.hybra.finance/"
            }
        })
    ]);

    const data1 = await res1.json();
    const pools = data1?.data?.v3Pools || [];
    const boosts = await res2.json();

    const mergedPools = pools.map(pool => {
        const tvlUSD = parseFloat(pool.totalValueLockedUSD);
        const score = parseFloat(pool.feesUSD ?? 0) / tvlUSD; // exemple, à adapter selon ta logique

        return {
            id: pool.id,
            symbol: `${pool.token0.symbol}/${pool.token1.symbol}`,
            feeTier: parseInt(pool.feeTier),
            tvlUSD,
            volumeUSD: parseFloat(pool.volumeUSD),
            feesUSD: parseFloat(pool.feesUSD),
            score,
            token0Address: pool.token0.id,
            token1Address: pool.token1.id,
            protocolType: "v3"
        };
    });


    const excludeLowTVL = document.getElementById("excludeLowTVL").checked;

    const ranked = mergedPools
        .filter(p => {
            const passesTVL = !excludeLowTVL || p.tvlUSD >= 50000;
            return passesTVL && p.score > 0;
        })
        .sort((a, b) => b.score - a.score);


    const tbody = document.querySelector("#poolTable tbody");
    tbody.innerHTML = "";

    ranked.forEach((p, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="pair-cell">
                <a href="https://www.hybra.finance/liquidity/add?token0=${p.token0Address}&token1=${p.token1Address}&fee=${p.feeTier}&type=${p.protocolType}" target="_blank" class="pair-name">${p.symbol}</a>
                <a href="https://dexscreener.com/hyperevm/${p.id}" target="_blank" class="chart-link">
                <img src="dexscreener-icon.png" alt="Chart" class="chart-icon" />
                </a>
            </td>
            <td>${p.boost}</td>
            <td>${p.tvlUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            <td>${(p.tvlRatio * 100).toFixed(2)}%</td>
            <td>${(p.score * 1e6).toFixed(2)}</td>
            `;

        tbody.appendChild(row);
    });

    document.getElementById("lastUpdate").textContent =
        "Last update : " + new Date().toLocaleTimeString();
}


// Appels initiaux
updatePoolsTable();
setInterval(updatePoolsTable, 60 * 1000);

// Export global pour rangeSwitcher
window.updatePoolsTable = updatePoolsTable;
