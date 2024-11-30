const { hashMessage, signMessage, signTypedData } = require('viem/accounts');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');
const path = require('path');
const mockAccount = require('./mockAccount.json');
const { getRollupBytes32 } = require('../../../test/pSymm/contract/pSymm.collateral.js');
const { signCreateCustodyRollupParams, signTransferToCustodyRollupParams, signTransferFromCustodyRollupParams } = require('../../../test/pSymm/contract/pSymm.EIP712.js');


class CustodyRollupTree {
    constructor(addressA, addressB, custodyRollupId) {
        this.addressA = addressA;
        this.addressB = addressB;
        this.custodyRollupId = custodyRollupId;
        this.transactions = [];
        this.loadOrCreateJson();
    }

    loadOrCreateJson() {
        const dirA = path.join(__dirname, `./custodyRollupId/${this.addressA}`);
        const dirB = path.join(__dirname, `./custodyRollupId/${this.addressB}`);
        const filePathA = path.join(dirA, `${this.custodyRollupId}.json`);
        const filePathB = path.join(dirB, `${this.custodyRollupId}.json`);

        if (!fs.existsSync(filePathA) || !fs.existsSync(filePathB)) {
            fs.mkdirSync(dirA, { recursive: true });
            fs.mkdirSync(dirB, { recursive: true });
            fs.writeFileSync(filePathA, JSON.stringify([]));
            fs.writeFileSync(filePathB, JSON.stringify([]));
        }

        this.jsonDataA = JSON.parse(fs.readFileSync(filePathA));
        this.jsonDataB = JSON.parse(fs.readFileSync(filePathB));
    }

    auth(isA, viemAccount) {
        this.isA = isA;
        this.viemAccount = viemAccount;
        this.authenticatedAddress = viemAccount.address;
        return this;
    }

    newTx(type) {
        const tx = { params: {type}, eip712Type: null };
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
                const filePath = (this.authenticatedAddress.toLowerCase() === this.addressA.toLowerCase()) ? 
                    path.join(__dirname, `./custodyRollupId/${this.addressA}/${this.custodyRollupId}.json`) : 
                    path.join(__dirname, `./custodyRollupId/${this.addressB}/${this.custodyRollupId}.json`);
                
                const jsonData = JSON.parse(fs.readFileSync(filePath));
                jsonData.push(tx);
                fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
                return chainable;
            },
        };

        return chainable;
    }

    receipt(send = false) {
        const ownFilePath = this.isA ? path.join(__dirname, `./custodyRollupId/${this.addressA}/${this.custodyRollupId}.json`) : path.join(__dirname, `./custodyRollupId/${this.addressB}/${this.custodyRollupId}.json`);
        const counterpartyFilePath = this.isA ? path.join(__dirname, `./custodyRollupId/${this.addressB}/${this.custodyRollupId}.json`) : path.join(__dirname, `./custodyRollupId/${this.addressA}/${this.custodyRollupId}.json`);
        
        const ownJsonData = JSON.parse(fs.readFileSync(ownFilePath));
        const counterpartyJsonData = JSON.parse(fs.readFileSync(counterpartyFilePath));

        const lastTx = ownJsonData[ownJsonData.length - 1];

        if (!lastTx) {
            throw new Error("No transaction to sign");
        }

        if (!lastTx.params.nonce) {
            lastTx.params.nonce = this.isA ? `0xA${ownJsonData.length}` : `0xB${ownJsonData.length}`;
        }

        const address = this.isA ? this.addressA : this.addressB;

        if (this.viemAccount.publicKey.toLowerCase() !== address.toLowerCase()) {
            throw new Error(`Authenticated account does not match the transaction address`);
        }

        const account = privateKeyToAccount(this.viemAccount.privateKey);
        const signature = account.signMessage({ message: JSON.stringify(lastTx.params) });

        // Initialize signatures array if not present
        lastTx.signatures = lastTx.signatures || [];
        lastTx.receipt = lastTx.receipt || [];

        // Store signature in the correct position
        console.log("Signature:", signature);

        if (this.isA) {
            lastTx.signatures[0] = signature.signature;
            lastTx.receipt[0] = signature.signature;
        } else {
            lastTx.signatures[1] = signature.signature;
            lastTx.receipt[1] = signature.signature;
        }

        fs.writeFileSync(ownFilePath, JSON.stringify(ownJsonData, null, 2));

        const chainable = {
            send: () => {
                if (send) {
                    const counterpartyTx = counterpartyJsonData.find(tx => tx.params.nonce === lastTx.params.nonce);
                    if (counterpartyTx) {
                        counterpartyTx.signatures = counterpartyTx.signatures || [];
                        if (this.isA) {
                            counterpartyTx.signatures[0] = signature.signature;
                        } else {
                            counterpartyTx.signatures[1] = signature.signature;
                        }
                        fs.writeFileSync(counterpartyFilePath, JSON.stringify(counterpartyJsonData, null, 2));
                    }
                }
                return this; // Return the instance for further chaining if needed
            }
        };

        return chainable;
    }
}


async function sendTransaction(isA, publicKeyA, publicKeyB, privateKey, custodyRollupId) {
    const basePath = path.join(__dirname, './custodyRollupId');
    const senderDirectory = isA ? publicKeyA : publicKeyB;
    const receiverDirectory = isA ? publicKeyB : publicKeyA;
    const senderFilePath = path.join(basePath, senderDirectory, `${custodyRollupId}.json`);
    const receiverFilePath = path.join(basePath, receiverDirectory, `${custodyRollupId}.json`);

    const transactions = JSON.parse(fs.readFileSync(senderFilePath));

    const lastUnsignedTx = transactions.reduce((lastTx, currentTx) => {
        if (!currentTx.signed && currentTx.params.nonce) {
            const currentNonceValue = parseInt(currentTx.params.nonce.slice(3), 10); // Extract the numeric part of the nonce
            const lastNonceValue = lastTx ? parseInt(lastTx.params.nonce.slice(3), 10) : -1;
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
        const pSymmAddress = '0x680471Fd71f207f8643B76Ba0414eE4D952484C7'; // <-- Replace this with your actual contract address
        switch (lastUnsignedTx.eip712Type) {
            case 'CreateCustodyRollupParams':
                signature = await signCreateCustodyRollupParams(lastUnsignedTx.params, privateKey, pSymmAddress);
                break;
            case 'TransferToCustodyRollupParams':
                signature = await signTransferToCustodyRollupParams(lastUnsignedTx.params, privateKey, pSymmAddress);
                break;
            case 'TransferFromCustodyRollupParams':
                signature = await signTransferFromCustodyRollupParams(lastUnsignedTx.params, privateKey, pSymmAddress);
                break;
            default:
                throw new Error(`Unsupported EIP712 type: ${lastUnsignedTx.eip712Type}`);
        }
    } else {
        signature = await signMessage({ message: JSON.stringify(lastUnsignedTx.params), privateKey: privateKey });
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
    fs.writeFileSync(receiverFilePath, JSON.stringify(receiverTransactions, null, 2));

    console.log(`Transaction sent and signed: ${lastUnsignedTx.params.nonce}`);

    
}



function resetCustodyRollupIdFolder() {
    const directoryPath = path.join(__dirname, './custodyRollupId');
    if (fs.existsSync(directoryPath)) {
        fs.readdirSync(directoryPath).forEach(file => {
            const filePath = path.join(directoryPath, file);
            fs.rmSync(filePath, { recursive: true });
        });
    }
}

resetCustodyRollupIdFolder();
const addressA = mockAccount[0].publicKey;
const addressB = mockAccount[1].publicKey;
const pkA = mockAccount[0].privateKey;
const pkB = mockAccount[1].privateKey;
const custodyRollupId = getRollupBytes32(addressA, addressB, 1);

const rollupA = new CustodyRollupTree(addressA, addressB, custodyRollupId);
const rollupB = new CustodyRollupTree(addressB, addressA, custodyRollupId);
rollupA.auth(true, privateKeyToAccount(pkA));
rollupB.auth(false, privateKeyToAccount(pkB));

rollupA.newTx("rfa/swap/open")
    .param("ISIN", "BTC")
    .param("amount", "1000000000000000000")
    .param("price", "1000000000000000000")
    .param("side", "buy")
    .param("fundingRate", 1)
    .param("IM_A", "1000000000000000000")
    .param("IM_B", "1000000000000000000")
    .param("MM_A", "1000000000000000000")
    .param("MM_B", "1000000000000000000")
    .param("CVA_A", "1000000000000000000")
    .param("CVA_B", "1000000000000000000")
    .param("MC_A", "1000000000000000000")
    .param("MC_B", "1000000000000000000")
    .param("contractExpiry", 1723232323232)
    .param("pricePrecision", 3)
    .param("fundingRatePrecision", 3)
    .param("cancelGracePeriod", 30000)
    .param("minContractAmount", 10)
    .param("oracleType", "mock")
    .param("expiration", Date.now() + 1000000)
    .param("timestamp", Date.now())
    .param("nonce", `0xA0`)
    .build();

(async () => {
    await sendTransaction(true, addressA, addressB, pkA, custodyRollupId);
})();

// Create a new transaction with specific parameters
rollupB.newTx("rfqFill/swap/open")
    .param("amount", "1000000000000000000")
    .param("price", "1000000000000000000")
    .param("rfqNonce", "0xA0")
    .param("expiration", Date.now() + 1000000 )
    .param("timestamp", Date.now())
    .param("nonce", `0xB1`)
    .build();

(async () => {
    await sendTransaction(false, addressB, addressA, pkB, custodyRollupId);
})();

rollupA.newTx("custodyRollup/deposit/erc20")
    .eip712("TransferToCustodyRollupParams")
    .param("partyA", addressA)
    .param("partyB", addressB)
    .param("custodyRollupId", 1)
    .param("collateralAmount", "10")
    .param("collateralToken", "0xB234567890123456789012345678901234567890")
    .param("expiration", Date.now() + 1000000)
    .param("timestamp", Date.now())
    .param("nonce", `0xA2`)
    .build();

(async () => {
    await sendTransaction(true, addressA, addressB, pkA, custodyRollupId);
})();
    

