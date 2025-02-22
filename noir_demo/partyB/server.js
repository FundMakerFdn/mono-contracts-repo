const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, 'storage.json');

// Initialize Storage
const initStorage = () => {
    if (!fs.existsSync(STORAGE_PATH)) {
        fs.writeFileSync(STORAGE_PATH, JSON.stringify({

        }));
    }
}

initStorage();

const wss = new WebSocket.Server({
    port: 3002
});

wss.on('connection', (ws) => {
    console.log('PartyA is connected!');

    ws.on('message', (data) => {
        try {
            console.log('message from PartyA: ', data);
            const message = JSON.parse(data);

            // Store message
            const storage = JSON.parse(fs.readFileSync(STORAGE_PATH));
            storage.messages = [message, ...storage.messages];
            fs.writeFileSync(STORAGE_PATH, JSON.stringify(storage));

            const response = {
                type: 'response',
                orderId: message.orderId,
                status: 'processed'
            };

            ws.send(JSON.stringify(response));
        } catch (error) {
            console.error('Error processing message', error);
        }
    })
});

console.log('PartyB server running on port 3002');