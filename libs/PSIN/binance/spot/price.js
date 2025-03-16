// ./binance/spot/price.js
export async function getPrice(asset) {
    const endpoint = `https://api.binance.com/api/v3/ticker/bookTicker?symbol=${asset}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Binance price API error: ${response.status}`);
    }
    const data = await response.json();
    return { bid: data.bidPrice, ask: data.askPrice };
  }