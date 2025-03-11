// Time logging utility
const timeLog = (...args) =>
  console.log(`${Math.ceil(process.uptime() * 1000)}ms\t`, ...args);

class pSymmVM {
  constructor(config) {
    this.sessions = {}; // counterpartyIP => session object
    // session object stores {phase, mesh, counterpartyPubKey, counterpartyGuardianIP, counterpartyGuardianPubKey}
    this.binanceProvider = config.binanceProvider;
    this.rpcProvider = config.rpcProvider;
    this.guardianIP = config.guardianIP;
    this.pubKey = config.pubKey;
  }

  createDefaultSession(counterpartyIP) {
    return {
      phase: "INIT",
      counterpartyIP,
      counterpartyPubKey: null,
      counterpartyGuardianIP: null, // will be added to mesh
      counterpartyGuardianPubKey: null,
      msgSeqNum: 1, // todo: also track counterparty seqnum
    };
  }
  meshMsg(counterpartyIP, msg) {
    const session = this.sessions[counterpartyIP];
    const dest = [session.counterpartyIP];
    if (session.counterpartyGuardianIP)
      dest.push(session.counterpartyGuardianIP);
    return {
      dest,
      msg,
    };
  }

  processMessage(counterpartyIP, inputItem) {
    // inputItem: {type: 'init' | 'peer', msg: Object}
    // return value: [meshMsg(counterpartyIP, msg)]

    // init input item is pushed by pSymmParty on new connection
    if (inputItem.type == "init") {
      this.sessions[counterpartyIP] = this.createDefaultSession(counterpartyIP);
      return [];
    }

    const session = this.sessions[counterpartyIP];

    switch (session.phase) {
      case "INIT": // init (set before send PPM template)
        return this.handleInitPhase(counterpartyIP, inputItem.msg);

      case "PKXCHG": // set before pubkeys exchange
        return this.handlePkxchgPhase(counterpartyIP, inputItem.msg);

      case "TRADE": // set to start trading
        return this.handleTradePhase(counterpartyIP, inputItem.msg);

      default:
        timeLog(`Unknown phase: ${session.phase}`);
        return null;
    }
  }

  // will be override by concrete implementations
  handleInitPhase(counterpartyIP, inputMsg) {}
  handlePkxchgPhase(counterpartyIP, inputMsg) {}
  handleTradePhase(counterpartyIP, inputMsg) {}

  createLogonMessage(counterpartyIP) {
    const session = this.sessions[counterpartyIP];
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
      GuardianIP: this.guardianIP,
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

  handleInitPhase(counterpartyIP, inputMsg) {
    if (inputMsg?.StandardHeader?.MsgType === "PPMTR") {
      // PPM template request
      const session = this.sessions[counterpartyIP];
      session.phase = "PKXCHG";
      this.sessions[counterpartyIP] = session;

      return [
        this.meshMsg(counterpartyIP, {
          StandardHeader: { MsgType: "PPMT" },
          PPMT: this.ppmTemplate,
        }),
      ];
    } else {
      return [this.meshMsg(counterpartyIP, this.createErrorMessage())];
    }
  }

  handlePkxchgPhase(counterpartyIP, inputMsg) {
    if (inputMsg?.StandardHeader?.MsgType === "A") {
      // Store counterparty keys
      const session = this.sessions[counterpartyIP];
      session.counterpartyPubKey = inputMsg.StandardHeader.SenderCompID;
      session.counterpartyGuardianPubKey = inputMsg.StandardTrailer.PublicKey;
      session.counterpartyGuardianIP = inputMsg.GuardianIP;
      session.phase = "TRADE";
      this.sessions[counterpartyIP] = session;

      return [this.meshMsg(counterpartyIP, this.createLogonMessage(counterpartyIP))];
    } else {
      return [this.meshMsg(counterpartyIP, this.createErrorMessage())];
    }
  }

  handleTradePhase(counterpartyIP, inputMsg) {
    // TODO
  }
}

module.exports = { pSymmVM, pSymmSolverVM, timeLog };
