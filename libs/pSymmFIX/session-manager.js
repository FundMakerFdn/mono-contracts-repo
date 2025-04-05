class Session {
    constructor(checks = []) {
        this.checks = checks;
        this.messages = [];
        this.lastSeqNums = new Map(); // Track last sequence number per sender
    }

    handleMessage(message) {
        // Run all validation checks
        for (const check of this.checks) {
            const result = check(message);
            if (!result) {
                throw new Error(`Message failed validation check: ${check.name}`);
            }
        }

        const senderCompId = message.SenderCompID;
        
        if (message.MsgType === 'ACK') {
            // Find and update the acknowledged message
            const targetMessage = this.messages.find(msg => 
                msg.SenderCompID === message.TargetCompID && 
                msg.MsgSeqNum === message.RefMsgSeqNum
            );
            
            if (targetMessage) {
                targetMessage.signature = message.signature;
            }
        } else {
            // Add new message
            this.messages.push(message);
        }

        // Update sequence number for this sender
        const seqNum = parseInt(message.MsgSeqNum, 10);
        this.lastSeqNums.set(senderCompId, seqNum);
    }

    getLastSeqNum(senderCompId) {
        return this.lastSeqNums.get(senderCompId) || 0;
    }

    getMessages() {
        return [...this.messages];
    }
}

module.exports = Session;
