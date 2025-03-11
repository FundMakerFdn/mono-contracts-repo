// Time logging utility
const timeLog = (...args) =>
  console.log(`${Math.ceil(process.uptime() * 1000)}ms\t`, ...args);

class pSymmVM {
  constructor(config) {
    this.sessions = new Map(); // counterpartyIP => session object
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
    return {
      dest: [session.counterpartyIP, session.counterpartyGuardianIP],
      msg,
    };
  }

  processMessage(counterpartyIP, inputItem) {
    // inputItem: {type: 'init' | 'peer', msg: Object}
    // return value: [meshMsg(counterpartyIP, msg)]

    // init input item is pushed by pSymmParty on new connection
    if (inputItem.type == "init") {
      // this.sessions[counterpartyIP].set(create defaultSession)
      return [];
    }

    session = this.sessions.get(counterpartyIP);

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

  handleInitPhase(counterpartyIP, inputMsg) {}
  handlePkxchgPhase(counterpartyIP, inputMsg) {}
  handleTradePhase(counterpartyIP, inputMsg) {}

  createLogonMessage() {
    // TODO: create FIX builder lib
    return {
      StandardHeader: {
        BeginString: "pSymm.FIX.2.0",
        MsgType: "A",
        DeploymentID: 101,
        SenderCompID: this.pubKey,
        TargetCompID: this.counterpartyPubKey,
        MsgSeqNum: this.msgSeqNum++,
        CustodyID: "0xCustody123", // todo: PPM
        SendingTime: (Date.now() * 1000000).toString(),
      },
      HeartBtInt: 10,
      StandardTrailer: {
        PublicKey: "0xPartyA",
        Signature: "0xSignature",
      },
    };
  }
  createErrorMessage() {
    // TODO: proper message
    return { StandardHeader: { MsgType: "j" } };
  }
}

class pSymmSolverVM extends pSymmVM {
  constructor(config) {
    super(config);
    this.ppmTemplate = config.ppmTemplate;
  }

  handleInitPhase(counterpartyIP, inputMsg) {
    // if (inputMsg?.StandardHeader?.MsgType === "PPMTR") { // PPM template request
    //    return {StandardHeader: {MsgType: "PPMT"}, PPMT: this.ppmTemplate};
    //    set sessions counterpartyIP phase to PKXCHG
    // else return [invalid message]
  }

  handlePkxchgPhase(counterpartyIP, inputMsg) {
    if (inputMsg?.StandardHeader?.MsgType === "A") {
      // Store counterparty keys
      // write the data below into session state:
      // counterpartyPubKey = inputMsg.pubKey;
      // counterpartyGuardianPubKey = inputMsg.guardianPubKey;
      // counterpartyGuardianIP = inputMsg.guardianIP;
      // set sesssion phase to TRADE
      // return [this.createLogonMessage()];
    }
    // else return [invalid message]
  }

  handleTradePhase(counterpartyIP, inputMsg) {
    // TODO
  }
}

module.exports = { pSymmVM, pSymmSolverVM, timeLog };
