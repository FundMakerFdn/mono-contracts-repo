// ./bybit/futures/price.js
export async function getPrice(asset) {
    const endpoint = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${asset}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Bybit price API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.retCode !== 0 || !data.result || !data.result.list || data.result.list.length === 0) {
      throw new Error("Bybit ticker data unavailable");
    }
    const tickerData = data.result.list[0];
    return { bid: tickerData.bid1Price, ask: tickerData.ask1Price };
  }