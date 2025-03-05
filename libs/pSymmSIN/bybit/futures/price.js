// ./bybit/futures/price.js
export async function getPrice(asset) {
    const endpoint = `https://api.bybit.com/v2/public/tickers?symbol=${asset}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Bybit price API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.ret_code !== 0 || !data.result || data.result.length === 0) {
      throw new Error("Bybit ticker data unavailable");
    }
    const tickerData = data.result[0];
    return { bid: tickerData.bid_price, ask: tickerData.ask_price };
  }
  