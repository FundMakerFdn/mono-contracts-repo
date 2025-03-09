// Time logging utility
const timeLog = (...args) =>
  console.log(`${Math.ceil(process.uptime() * 1000)}ms\t`, ...args);

class pSymmVM {
  constructor() {
    // Session state for each counterparty
    this.sessions = new Map(); // counterpartyIP => { phase, ... }
  }

  createSession() {
    return { phase: "INIT" };
  }

  processMessage(counterpartyIP, inputMsg) {
    // Get or initialize session state
    let session = this.sessions.get(counterpartyIP);
    if (!session) {
      session = this.createSession();
      this.sessions.set(counterpartyIP, session);
    }

    // Process message based on current phase
    switch (session.phase) {
      case "INIT":
        return this.handleInitPhase(counterpartyIP, session, inputMsg);

      case "PKXCHG":
        return this.handlePkxchgPhase(counterpartyIP, session, inputMsg);

      case "TRADE":
        return this.handleTradePhase(counterpartyIP, session, inputMsg);

      default:
        timeLog(`Unknown phase: ${session.phase}`);
        return null;
    }
  }

  handleInitPhase(counterpartyIP, session, inputMsg) {
    // Template implementation
    if (inputMsg.type === "request_template") {
      // Transition to PKXCHG phase
      session.phase = "PKXCHG";
      return {
        type: "template",
        template: "PPM_TEMPLATE_PLACEHOLDER",
      };
    }
    return null;
  }

  handlePkxchgPhase(counterpartyIP, session, inputMsg) {
    // Template implementation
    if (inputMsg.type === "login") {
      // Store counterparty keys
      session.counterpartyPubKey = inputMsg.pubKey;
      session.counterpartyGuardianPubKey = inputMsg.guardianPubKey;
      session.counterpartyGuardianIP = inputMsg.guardianIP;

      // Transition to TRADE phase
      session.phase = "TRADE";

      return {
        type: "login_response",
        pubKey: "OUR_PUBKEY_PLACEHOLDER",
        guardianPubKey: "OUR_GUARDIAN_PUBKEY_PLACEHOLDER",
        guardianIP: "OUR_GUARDIAN_IP_PLACEHOLDER",
      };
    }
    return null;
  }

  handleTradePhase(counterpartyIP, session, inputMsg) {
    // Template implementation
    if (inputMsg.type === "ack") {
      return {
        type: "ready_to_trade",
      };
    }
    return null;
  }
}

module.exports = { pSymmVM, timeLog };
