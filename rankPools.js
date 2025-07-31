async function updatePoolsTable() {
    console.log("⏳ updatePoolsTable called...");
    const rangePercent = getCurrentRangePercent();

    const graphQLEndpoint = "https://api.goldsky.com/api/public/project_cmbbm2iwckb1b01t39xed236t/subgraphs/uniswap-v3-hyperevm-position/prod/gn";

    const graphQLPayload = {
        operationName: "ConsolidatedPoolsData",
        variables: {
            tvl: "0",
            vol: "0",
            limit: 1000,
            offset: 0,
            orderBy: "totalValueLockedUSD",
            orderDirection: "desc",
            periodStart: Math.floor(Date.now() / 1000) - 86400, // 24h
            blockedTokens: [
                "0x729655088da8624c1004bf2705e3a3eeebdf0d6d",
                "0xb07f5e05d67dfbd6ea2300c8f788c1365b44a834"
            ]
        },
        query: `
        query ConsolidatedPoolsData(
            $tvl: BigDecimal!,
            $vol: BigDecimal!,
            $limit: Int!,
            $offset: Int!,
            $orderBy: String!,
            $orderDirection: String!,
            $periodStart: Int!,
            $blockedTokens: [String!]!
        ) {
            v3Pools: pools(
                first: $limit
                skip: $offset
                orderBy: $orderBy
                orderDirection: $orderDirection
                where: {
                    liquidity_gt: 0,
                    totalValueLockedUSD_gte: $tvl,
                    volumeUSD_gte: $vol,
                    token0_not_in: $blockedTokens,
                    token1_not_in: $blockedTokens
                }
            ) {
                id
                token0 { symbol id decimals }
                token1 { symbol id decimals }
                totalValueLockedUSD
                feeTier
                liquidity
                sqrtPrice
                tick
                ticks(first: 1000) {
                    tickIdx
                    liquidityGross
                    liquidityNet
                }
                feesUSD
                poolDayData(first: 1, orderBy: date, orderDirection: desc) {
                    volumeUSD
                    feesUSD
                }
            }
        }`
    };

    // Helpers
    const getPriceFromSqrtPriceX96 = (sqrtX96) => {
        return (parseFloat(sqrtX96) / (2 ** 96)) ** 2;
    };

    const getTickFromPrice = (price) => {
        return Math.floor(Math.log(price) / Math.log(1.0001));
    };

    const calcActiveTVL = (pool, rangePercent) => {
        const currentPrice = getPriceFromSqrtPriceX96(pool.sqrtPrice);
        const lowerPrice = currentPrice * (1 - rangePercent / 100);
        const upperPrice = currentPrice * (1 + rangePercent / 100);

        const lowerTick = getTickFromPrice(lowerPrice);
        const upperTick = getTickFromPrice(upperPrice);

        let liqTotal = 0;
        let liqInRange = 0;

        pool.ticks.forEach(t => {
            const liq = Math.abs(parseFloat(t.liquidityGross));
            liqTotal += liq;
            if (t.tickIdx >= lowerTick && t.tickIdx <= upperTick) {
                liqInRange += liq;
            }
        });

        // DEBUG LOG
        console.log(`--- Pool ${pool.token0.symbol}/${pool.token1.symbol} ---`);
        console.log(`Current Price: ${currentPrice}`);
        console.log(`Lower Price: ${lowerPrice}`);
        console.log(`Upper Price: ${upperPrice}`);
        console.log(`Lower Tick: ${lowerTick}`);
        console.log(`Upper Tick: ${upperTick}`);
        console.log(`Total Liquidity: ${liqTotal}`);
        console.log(`Liquidity In Range: ${liqInRange}`);
        console.log(`Ratio: ${liqTotal > 0 ? (liqInRange / liqTotal) : 0}`);

        if (liqTotal === 0) return 0;
        return liqInRange / liqTotal; // ratio
    };




    const res1 = await fetch(graphQLEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Origin": "https://www.hybra.finance",
            "Referer": "https://www.hybra.finance/"
        },
        body: JSON.stringify(graphQLPayload)
    });

    if (!res1.ok) {
        document.getElementById("lastUpdate").textContent = `⚠️ API error (${res1.status})`;
        return;
    }

    const data1 = await res1.json();

    if (data1.errors) {
        document.getElementById("lastUpdate").textContent = `⚠️ API error: ${data1.errors[0].message}`;
        return;
    }

    const pools = data1?.data?.v3Pools || [];

    const mergedPools = pools.map(pool => {
        const tvlActive = rangePercent === null
            ? 1
            : calcActiveTVL(pool, rangePercent);
        const fees24h = parseFloat(pool.poolDayData?.[0]?.feesUSD ?? 0);
        const tvlActiveUSD = pool.totalValueLockedUSD * tvlActive;
        const score = fees24h * 100000 / (tvlActiveUSD || 1);

        return {
            id: pool.id,
            symbol: `${pool.token0.symbol}/${pool.token1.symbol}`,
            feeTier: parseInt(pool.feeTier),
            tvlUSD: parseFloat(pool.totalValueLockedUSD),
            tvlActive,
            feesUSD: fees24h,
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
            const passesFees = p.feesUSD >= 50;
            return passesTVL && passesFees && p.score > 0;
        })
        .sort((a, b) => b.score - a.score);

    const tbody = document.querySelector("#poolTable tbody");
    tbody.innerHTML = "";

    ranked.forEach((p, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td class="pair-cell">
                <a href="https://www.prjx.com/deposit?tokenA=${p.token0Address}&tokenB=${p.token1Address}&fee=${p.feeTier}&type=${p.protocolType}" target="_blank" class="pair-name">${p.symbol}</a>
                <a href="https://dexscreener.com/hyperevm/${p.id}" target="_blank" class="chart-link">
                <img src="dexscreener-icon.png" alt="Chart" class="chart-icon" />
                </a>
            </td>
            <td>${p.feesUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}$</td>
            <td>${p.tvlUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}$</td>
            <td>${(p.tvlActive * 100).toFixed(2)}%</td>
            <td>${(p.score * 100).toFixed(0)}</td>
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
