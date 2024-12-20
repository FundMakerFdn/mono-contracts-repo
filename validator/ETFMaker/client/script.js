async function getCurrentPrice(etfName = 'test') {
    const url = `http://localhost:5000/current_price?etfName=${etfName}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    return data['etfPrice'];
}

function updatePriceEverySecond() {
    setInterval(async () => {
        console.log('Updating price');
        const price = await getCurrentPrice('test');
        console.log(price);
        document.getElementById('currentPrice').textContent = price;
    }, 1000); 
}

updatePriceEverySecond();