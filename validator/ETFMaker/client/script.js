
async function getWeeklyPrices(etfName = 'test'){
    const url = `http://localhost:5000/weekly_prices?etfName=${etfName}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
    return data;
}

async function drawChart(weeklyPrices) {
    const ctx = document.getElementById('etfChart').getContext('2d');

    const labels = weeklyPrices.map(entry => new Date(entry.timestamp).toLocaleDateString());
    const data = weeklyPrices.map(entry => parseFloat(entry.value));

    new Chart(ctx, {
        type: 'line', 
        data: {
            labels: labels,
            datasets: [{
                label: 'ETF Weekly Prices',
                data: data,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

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


drawChart(await getWeeklyPrices());
//updatePriceEverySecond();