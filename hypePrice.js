async function fetchHypePrice() {
  const endpoint = "https://api.goldsky.com/api/public/project_cmbj707z4cd9901sib1f6cu0c/subgraphs/hybra-v3/v3/gn";

  const payload = {
    operationName: "getEthPrice",
    variables: {},
    query: `query getEthPrice {
      bundle(id: "1") {
        ethPriceUSD
      }
    }`
  };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://www.hybra.finance",
        "Referer": "https://www.hybra.finance/"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    const price = parseFloat(data?.data?.bundle?.ethPriceUSD ?? 0);
    document.getElementById("hypePriceText").textContent =
      `$${price.toFixed(2)}`;
  } catch (err) {
    document.getElementById("hypePriceText").textContent = `Erreur`;
    document.getElementById("hypePriceBadge").textContent =
      `$HYPE price: erreur`;
  }
}
fetchHypePrice();
setInterval(fetchHypePrice, 5 * 1000);
