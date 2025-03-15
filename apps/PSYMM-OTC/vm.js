// Time logging utility
const timeLog = (...args) =>
  console.log(`${Math.ceil(process.uptime() * 1000)}ms\t`, ...args);

class pSymmVM {
  constructor(config) {
    this.sessions = {}; // counterpartyPubKey => session object
    this.ppmStorage = config.ppmStorage;
    this.guardianPubKey = config.guardianPubKey;
    this.pubKey = config.pubKey;
  }

  createDefaultSession(counterpartyPubKey) {
    return {
      phase: "INIT",
      counterpartyPubKey,
      counterpartyGuardianPubKey: null,
      msgSeqNum: 1, // todo: also track counterparty seqnum
    };
  }

  processMessage(counterpartyPubKey, inputItem) {
    // inputItem: {type: 'init' | 'peer', msg: Object}
    // return value: [{counterpartyPubKey, msg}]

    // init input item is pushed by pSymmParty on new connection
    if (inputItem.type == "init") {
      this.sessions[counterpartyPubKey] =
        this.createDefaultSession(counterpartyPubKey);
      return [];
    }

    const session = this.sessions[counterpartyPubKey];

    switch (session.phase) {
      case "INIT": // init (set before send PPM template)
        return this.handleInitPhase(counterpartyPubKey, inputItem.msg);

      case "PKXCHG": // set before pubkeys exchange
        return this.handlePkxchgPhase(counterpartyPubKey, inputItem.msg);

      case "TRADE": // set to start trading
        return this.handleTradePhase(counterpartyPubKey, inputItem.msg);

      default:
        timeLog(`Unknown phase: ${session.phase}`);
        return null;
    }
  }

  renderPPMT(counterpartyPubKey) {
    // Deep clone the template to avoid modifying the original
    const template = JSON.parse(JSON.stringify(this.ppmTemplate));

    // Process each entry in the template
    for (const entry of template) {
      if (entry.party === "owner") {
        entry.pubKey = this.pubKey;
      } else if (entry.party === "guardian") {
        entry.pubKey = this.guardianPubKey;
      }
    }

    return template;
  }

  // will be override by concrete implementations
  handleInitPhase(counterpartyPubKey, inputMsg) {}
  handlePkxchgPhase(counterpartyPubKey, inputMsg) {}
  handleTradePhase(counterpartyPubKey, inputMsg) {}

  createLogonMessage(counterpartyPubKey) {
    const session = this.sessions[counterpartyPubKey];
    return {
      StandardHeader: {
        BeginString: "pSymm.FIX.2.0",
        MsgType: "A",
        DeploymentID: 101,
        SenderCompID: this.pubKey,
        TargetCompID: session.counterpartyPubKey,
        MsgSeqNum: session.msgSeqNum++,
        CustodyID: "0xCustody123", // todo: PPM
        SendingTime: (Date.now() * 1000000).toString(),
      },
      HeartBtInt: 10,
      StandardTrailer: {
        // todo: sign
        PublicKey: this.pubKey,
        Signature: "0xSignature",
      },
    };
  }
  createErrorMessage() {
    // TODO: proper logic reject message
    return { StandardHeader: { MsgType: "j" } };
  }
}

class pSymmSolverVM extends pSymmVM {
  constructor(config) {
    super(config);
    this.ppmTemplate = config.ppmTemplate;
  }

  handleInitPhase(counterpartyPubKey, inputMsg) {
    if (inputMsg?.StandardHeader?.MsgType === "PPMTR") {
      // PPM template request
      const session = this.sessions[counterpartyPubKey];
      session.phase = "PKXCHG";
      this.sessions[counterpartyPubKey] = session;

      return [
        {
          counterpartyPubKey,
          msg: {
            StandardHeader: { MsgType: "PPMT" },
            PPMT: this.ppmTemplate,
          },
        },
      ];
    } else {
      return [{ counterpartyPubKey, msg: this.createErrorMessage() }];
    }
  }

  handlePkxchgPhase(counterpartyPubKey, inputMsg) {
    if (inputMsg?.StandardHeader?.MsgType === "A") {
      // Store counterparty keys
      const session = this.sessions[counterpartyPubKey];
      session.counterpartyGuardianPubKey = inputMsg.StandardTrailer.PublicKey;
      session.counterpartyGuardianIP = inputMsg.GuardianIP;
      session.phase = "TRADE";
      session.PPM = this.renderPPMT(counterpartyPubKey);
      this.sessions[counterpartyPubKey] = session;

      return [
        {
          counterpartyPubKey,
          msg: this.createLogonMessage(counterpartyPubKey),
        },
      ];
    } else {
      return [{ counterpartyPubKey, msg: this.createErrorMessage() }];
    }
  }

  handleTradePhase(counterpartyPubKey, inputMsg) {
    // TODO
  }
}

class pSymmTraderVM extends pSymmVM {
  constructor(config) {
    super(config);
  }

  handleInitPhase(counterpartyPubKey, inputMsg) {
    // Trader initiates by requesting PPM template
    const session = this.sessions[counterpartyPubKey];
    session.phase = "PKXCHG";
    this.sessions[counterpartyPubKey] = session;

    return [
      {
        counterpartyPubKey,
        msg: {
          StandardHeader: { MsgType: "PPMTR" },
        },
      },
    ];
  }

  handlePkxchgPhase(counterpartyPubKey, inputMsg) {
    if (inputMsg?.StandardHeader?.MsgType === "PPMT") {
      // Received PPM template, store it and send logon
      const session = this.sessions[counterpartyPubKey];
      session.ppmTemplate = inputMsg.PPMT;

      // Send logon message to initiate key exchange
      return [
        {
          counterpartyPubKey,
          msg: this.createLogonMessage(counterpartyPubKey),
        },
      ];
    } else if (inputMsg?.StandardHeader?.MsgType === "A") {
      // Received logon response, store counterparty keys
      const session = this.sessions[counterpartyPubKey];
      session.counterpartyGuardianPubKey = inputMsg.StandardTrailer.PublicKey;
      session.counterpartyGuardianIP = inputMsg.GuardianIP;
      session.phase = "TRADE";
      this.sessions[counterpartyPubKey] = session;

      // No response needed, we're now in TRADE phase
      return [];
    } else {
      return [{ counterpartyPubKey, msg: this.createErrorMessage() }];
    }
  }

  handleTradePhase(counterpartyPubKey, inputMsg) {
    // TODO: Implement trade phase handling
    return [];
  }
}

module.exports = { pSymmVM, pSymmSolverVM, pSymmTraderVM, timeLog };
