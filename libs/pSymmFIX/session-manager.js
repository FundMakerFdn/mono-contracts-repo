class Session {
  constructor(checks = []) {
    this.checks = checks;
    this.messages = [];
  }

  handleMessage(message) {
    // Run all validation checks
    for (const check of this.checks) {
      const result = check.verify(message);
      if (!result) {
        throw new Error(`Message failed validation check: ${check.name}`);
      }
    }

    if (message.MsgType === "ACK") {
      // Find and update the acknowledged message
      const targetMessage = this.messages.find(
        (msg) =>
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
  }

  getMessages() {
    return [...this.messages];
  }
}

class SeqNumCheck {
  constructor() {
    this.name = "SeqNumCheck";
    this.seqNums = new Map();
  }

  verify(message) {
    const sender = message.SenderCompID;
    const seqNum = message.MsgSeqNum;

    if (message.MsgType === "ACK") {
      // For ACK messages, verify that RefMsgSeqNum matches the last sequence number
      // from the target party
      const targetLastSeq = this.seqNums.get(message.TargetCompID);
      if (targetLastSeq !== message.RefMsgSeqNum) {
        return false;
      }
    }

    // Get the last sequence number for this sender
    const lastSeqNum = this.seqNums.get(sender) || 0;

    // Verify sequence number is one more than the last one
    if (seqNum !== lastSeqNum + 1) {
      return false;
    }

    // Update the sequence number for this sender
    this.seqNums.set(sender, seqNum);
    return true;
  }
}

function createSession() {
  const seqNumCheck = new SeqNumCheck();
  const session = new Session([seqNumCheck]);
  return session;
}

module.exports = { createSession, Session, SeqNumCheck };
