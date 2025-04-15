export class MsgBuilder {
  constructor(config = {}) {
    // Store configuration for headers
    this.config = {
      beginString: config.beginString || "pSymm.FIX.2.0",
      senderCompID: config.senderCompID,
      custodyID: config.custodyID,
      msgSeqNum: config.msgSeqNum || 1,
    };
  }

  // Create standard header with auto-incrementing sequence number
  createHeader(msgType, targetCompID) {
    const header = {
      BeginString: this.config.beginString,
      MsgType: msgType,
      SenderCompID: this.config.senderCompID,
      TargetCompID: targetCompID,
      MsgSeqNum: this.config.msgSeqNum++,
      CustodyID: this.config.custodyID,
      SendingTime: (Date.now() * 1000000).toString(),
      SessionHash: null,
    };
    return header;
  }

  // Add standard trailer with null signature
  signMessage(message) {
    // Ensure StandardTrailer exists
    if (!message.StandardTrailer) {
      message.StandardTrailer = {};
    }

    message.StandardTrailer.Signature = null;
    return message;
  }

  // Create and sign a logon message
  createLogon(targetCompID, guardianPubKeys, heartBtInt = 10) {
    const message = {
      StandardHeader: this.createHeader("A", targetCompID),
      HeartBtInt: heartBtInt,
      GuardianPubKeys: guardianPubKeys,
    };
    return this.signMessage(message);
  }

  // Create and sign a heartbeat message
  createHeartbeat(targetCompID) {
    const message = {
      StandardHeader: this.createHeader("0", targetCompID),
    };
    return this.signMessage(message);
  }

  // Create and sign a PPM handshake request
  createPPMHandshake(targetCompID) {
    const message = {
      StandardHeader: this.createHeader("PPMH", targetCompID),
    };
    return this.signMessage(message);
  }

  // Create and sign a PPM template message
  createPPMTemplate(targetCompID, ppmTemplate) {
    const message = {
      StandardHeader: this.createHeader("PPMT", targetCompID),
      PPMT: ppmTemplate,
    };
    return this.signMessage(message);
  }

  // Create and sign a test request message
  createTestRequest(targetCompID, testReqID) {
    const message = {
      StandardHeader: this.createHeader("1", targetCompID),
      TestReqID: testReqID,
    };
    return this.signMessage(message);
  }

  // Create and sign a reject message
  createReject(targetCompID, refSeqNum, refMsgType, rejectReason) {
    const message = {
      StandardHeader: this.createHeader("3", targetCompID),
      RefSeqNum: refSeqNum,
      RefMsgType: refMsgType,
      RejectReason: rejectReason,
    };
    return this.signMessage(message);
  }

  // Create and sign a sequence reset message
  createSequenceReset(targetCompID, newSeqNo, gapFillFlag = true) {
    const message = {
      StandardHeader: this.createHeader("4", targetCompID),
      NewSeqNo: newSeqNo,
      GapFillFlag: gapFillFlag,
    };
    return this.signMessage(message);
  }
}
