export async function getPrice(asset) {
    const endpoint = `https://api.bitget.com/api/v2/mix/market/ticker?productType=USDT-FUTURES&symbol=${asset}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Bitget price API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.code !== "00000" || !data.data || !data.data.length) {
      throw new Error("Bitget ticker data unavailable");
    }
    const tickerData = data.data[0];
    return {
      bid: tickerData.bidPr, // Updated field
      ask: tickerData.askPr  // Updated field
    };
  }