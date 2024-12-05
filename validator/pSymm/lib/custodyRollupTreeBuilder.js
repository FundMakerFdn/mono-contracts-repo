const { hashMessage, signMessage, signTypedData } = require("viem/accounts");
const fs = require("fs");
const path = require("path");
const {
  signCreateCustodyParams,
  signTransferToCustodyParams,
  signTransferFromCustodyParams,
} = require("#root/test/pSymm/contract/pSymm.EIP712.js");

class custodyTree {
  constructor(addressA, addressB, custodyId) {
    this.addressA = addressA;
    this.addressB = addressB;
    this.custodyId = custodyId;
    this.transactions = [];
    this.loadOrCreateJson();
  }

  loadOrCreateJson() {
    const dirA = path.join(__dirname, `./custodyId/${this.addressA}`);
    const dirB = path.join(__dirname, `./custodyId/${this.addressB}`);
    const filePathA = path.join(dirA, `${this.custodyId}.json`);
    const filePathB = path.join(dirB, `${this.custodyId}.json`);

    if (!fs.existsSync(filePathA) || !fs.existsSync(filePathB)) {
      fs.mkdirSync(dirA, { recursive: true });
      fs.mkdirSync(dirB, { recursive: true });
      fs.writeFileSync(filePathA, JSON.stringify([]));
      fs.writeFileSync(filePathB, JSON.stringify([]));
    }

    this.jsonDataA = JSON.parse(fs.readFileSync(filePathA));
    this.jsonDataB = JSON.parse(fs.readFileSync(filePathB));
  }

  auth(viemAccount) {
    this.viemAccount = viemAccount;
    this.authenticatedAddress = viemAccount.address;
    return this;
  }

  newTx(type) {
    const tx = { params: { type }, eip712Type: null };
    this.transactions.push(tx);

    const chainable = {
      param: (key, value) => {
        tx.params[key] = value;
        return chainable;
      },
      eip712: (type) => {
        tx.eip712Type = type;
        return chainable;
      },
      nonce: (nonce) => {
        tx.params.nonce = nonce;
        return chainable;
      },
      verify: () => {
        // Implement verification logic here
        return chainable;
      },
      build: () => {
        const filePath =
          this.authenticatedAddress.toLowerCase() ===
          this.addressA.toLowerCase()
            ? path.join(
                __dirname,
                `./custodyId/${this.addressA}/${this.custodyId}.json`
              )
            : path.join(
                __dirname,
                `./custodyId/${this.addressB}/${this.custodyId}.json`
              );

        const jsonData = JSON.parse(fs.readFileSync(filePath));
        jsonData.push(tx);
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
        return chainable;
      },
    };

    return chainable;
  }

  async receipt(send = true) {
    const ownFilePath = path.join(
      __dirname,
      `./custodyId/${this.addressA}/${this.custodyId}.json`
    );
    const counterpartyFilePath = path.join(
      __dirname,
      `./custodyId/${this.addressB}/${this.custodyId}.json`
    );

    const ownJsonData = JSON.parse(fs.readFileSync(ownFilePath));
    const counterpartyJsonData = JSON.parse(
      fs.readFileSync(counterpartyFilePath)
    );

    const lastTx = ownJsonData[ownJsonData.length - 1];

    if (!lastTx) {
      throw new Error("No transaction to sign");
    }

    if (
      this.viemAccount.address.toLowerCase() !== this.addressA.toLowerCase()
    ) {
      throw new Error(
        `Authenticated account does not match the transaction address`
      );
    }

    const signature = await this.viemAccount.signMessage({
      message: JSON.stringify(lastTx.params),
    });

    // Initialize signatures array if not present
    lastTx.signatures = lastTx.signatures || [];

    // Store signature in the first position
    console.log("Signature:", signature);
    lastTx.signatures[0] = signature.signature;

    fs.writeFileSync(ownFilePath, JSON.stringify(ownJsonData, null, 2));

    const chainable = {
      send: () => {
        if (send) {
          const counterpartyTx = counterpartyJsonData.find(
            (tx) => tx.params.nonce === lastTx.params.nonce
          );
          if (counterpartyTx) {
            counterpartyTx.signatures = counterpartyTx.signatures || [];
            if (this.isA) {
              counterpartyTx.signatures[0] = signature.signature;
            } else {
              counterpartyTx.signatures[1] = signature.signature;
            }
            fs.writeFileSync(
              counterpartyFilePath,
              JSON.stringify(counterpartyJsonData, null, 2)
            );
          }
        }
        return this; // Return the instance for further chaining if needed
      },
    };

    return chainable;
  }
}

async function sendTransaction(
  isA,
  publicKeyA,
  publicKeyB,
  privateKey,
  custodyId
) {
  const basePath = path.join(__dirname, "./custodyId");
  const senderDirectory = isA ? publicKeyA : publicKeyB;
  const receiverDirectory = isA ? publicKeyB : publicKeyA;
  const senderFilePath = path.join(
    basePath,
    senderDirectory,
    `${custodyId}.json`
  );
  const receiverFilePath = path.join(
    basePath,
    receiverDirectory,
    `${custodyId}.json`
  );

  const transactions = JSON.parse(fs.readFileSync(senderFilePath));

  const lastUnsignedTx = transactions.reduce((lastTx, currentTx) => {
    if (!currentTx.signed && currentTx.params.nonce) {
      const currentNonceValue = parseInt(currentTx.params.nonce.slice(3), 10); // Extract the numeric part of the nonce
      const lastNonceValue = lastTx
        ? parseInt(lastTx.params.nonce.slice(3), 10)
        : -1;
      if (!lastTx || currentNonceValue > lastNonceValue) {
        return currentTx;
      }
    }
    return lastTx;
  }, null);

  if (!lastUnsignedTx) {
    throw new Error("No unsigned transactions found.");
  }

  let signature;
  if (lastUnsignedTx.eip712Type) {
    const pSymmAddress = "0x680471Fd71f207f8643B76Ba0414eE4D952484C7"; // <-- Replace this with your actual contract address
    switch (lastUnsignedTx.eip712Type) {
      case "CreateCustodyParams":
        signature = await signCreateCustodyParams(
          lastUnsignedTx.params,
          privateKey,
          pSymmAddress,
          custodyId
        );
        break;
      case "TransferToCustodyParams":
        signature = await signTransferToCustodyParams(
          lastUnsignedTx.params,
          privateKey,
          pSymmAddress,
          custodyId
        );
        break;
      case "TransferFromCustodyParams":
        signature = await signTransferFromCustodyParams(
          lastUnsignedTx.params,
          privateKey,
          pSymmAddress,
          custodyId
        );
        break;
      default:
        throw new Error(
          `Unsupported EIP712 type: ${lastUnsignedTx.eip712Type}`
        );
    }
  } else {
    signature = await signMessage({
      message: JSON.stringify(lastUnsignedTx.params),
      privateKey: privateKey,
    });
  }

  lastUnsignedTx.signatures = lastUnsignedTx.signatures || [null, null]; // Initialize with two elements
  const signatureIndex = isA ? 0 : 1;
  lastUnsignedTx.signatures[signatureIndex] = signature;

  fs.writeFileSync(senderFilePath, JSON.stringify(transactions, null, 2));

  // Simulate sending the transaction by copying it to the receiver's file
  let receiverTransactions = [];
  if (fs.existsSync(receiverFilePath)) {
    receiverTransactions = JSON.parse(fs.readFileSync(receiverFilePath));
  }
  receiverTransactions.push(lastUnsignedTx);
  fs.writeFileSync(
    receiverFilePath,
    JSON.stringify(receiverTransactions, null, 2)
  );

  console.log(`Transaction sent and signed: ${lastUnsignedTx.params.nonce}`);
}

function resetCustodyIdFolder() {
  const directoryPath = path.join(__dirname, "./custodyId");
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const filePath = path.join(directoryPath, file);
      fs.rmSync(filePath, { recursive: true });
    });
  }
}

module.exports = {
  resetCustodyIdFolder,
  sendTransaction,
  custodyTree,
};
