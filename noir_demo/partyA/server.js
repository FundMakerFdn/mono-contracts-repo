const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const STORAGE_PATH = path.join(__dirname, 'storage.json');

// Initialize Storage
const initStorage = () => {
    if (!fs.existsSync(STORAGE_PATH)) {
        fs.writeFileSync(STORAGE_PATH, JSON.stringify({

        }));
    }
}

initStorage();

// Init WebSocket
const wsClient = new WebSocket('ws://localhost:3002');

wsClient.on('open', () => {
    console.log('connected to partyB');
});

wsClient.on('message', (data) => {
    try {
        const message = JSON.parse(data);
        console.log('Received from PartyB:', message);

        // Save message into json
        storage.messages = [message, ...storage.messages];
        fs.writeFileSync(STORAGE_PATH, JSON.stringify(storage));

        // Send response
        const response = {
            type: 'response',
            orderId: message.orderId,
            status: 'accepted'
        };

        wsClient.send(JSON.stringify(response));
    } catch (error) {
        console.error('Error receiving message', error);
    }
})

app.post('/api/partyA/buy', (req, res) => {
    let amount = req.body.amount;
    const order = {
        type: 'order',
        orderId: Date.now().toString(),
        action: 'buy',
        amount
    };

    wsClient.send(JSON.stringify(order));
    res.json({ success: true });
});

app.post('/api/partyA/position', (req, res) => {
    const storage = JSON.parse(fs.readFileSync(STORAGE_PATH));
    res.json({ positions: storage.positions });
});

app.post('/api/partyA/collateral', (req, res) => {
    const storage = JSON.parse((fs.readFileSync(STORAGE_PATH)));
    res.json({

    })
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`PartyA server running on port ${PORT}`);
});