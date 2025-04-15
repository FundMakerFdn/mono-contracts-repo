import { keccak256 } from "viem";

export class Session {
  constructor(checks = []) {
    this.checks = checks;
    this.messages = [];
  }

  addMessage(message) {
    // Run all validation checks
    for (const check of this.checks) {
      const result = check.verify(message);
      if (!result) {
        throw new Error(`Message failed validation check: ${check.name}`);
      }
    }

    // Simply add message
    this.messages.push(message);
  }

  getSessionHash() {
    return keccak256(JSON.stringify(this.getMessages()));
  }

  getMessages() {
    return [...this.messages];
  }
}

export class SeqNumCheck {
  constructor() {
    this.name = "SeqNumCheck";
    this.seqNums = new Map();
    this.lastSendingTime = 0;
  }

  verify(message) {
    const sender = message.SenderCompID;
    const seqNum = message.MsgSeqNum;

    // Get the last sequence number for this sender
    const lastSeqNum = this.seqNums.get(sender) || 0;

    // Verify sequence number is one more than the last one
    if (seqNum !== lastSeqNum + 1) {
      return false;
    }

    // Added sending time validation
    const sendingTime = BigInt(message.StandardHeader.SendingTime);
    if (sendingTime <= this.lastSendingTime) return false;

    // Update both sequence number and sending time
    this.seqNums.set(sender, seqNum);
    this.lastSendingTime = sendingTime;
    return true;
  }
}

export function createSession() {
  const seqNumCheck = new SeqNumCheck();
  const session = new Session([seqNumCheck]);
  return session;
}
