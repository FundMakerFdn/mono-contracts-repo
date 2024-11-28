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
        return this;
    }

    newTx(type) {
        const tx = { type, params: {}, eip712Type: null };
        this.transactions.push(tx);

        const chainable = {
            param: (key, value) => {
                tx.params[key] = value;
                return chainable;
            },
            eip712: (type) => {
                if (!EIP712_TYPES[type]) {
                    throw new Error(`EIP-712 type ${type} is not defined`);
                }
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
            sign: (address, useEIP712 = false) => {
                const account = privateKeyToAccount(mockAccount.find(acc => acc.address === address).privateKey);
                let signature;
                if (useEIP712 && tx.eip712Type) {
                    signature = signTypedData({
                        domain: EIP712_DOMAIN,
                        types: EIP712_TYPES[tx.eip712Type],
                        value: tx.params,
                        privateKey: account.privateKey
                    });
                } else {
                    signature = account.signMessage({ message: JSON.stringify(tx.params) });
                }
                tx.signatures = tx.signatures || [];
                tx.signatures.push(signature);
                return chainable;
            },
            build: () => {
                if (!tx.params.nonce) {
                    tx.params.nonce = this.isA ? `0xA${this.transactions.length}` : `0xB${this.transactions.length}`;
                }
                return chainable;
            },
            send: () => {
                const filePath = this.isA ? path.join(__dirname, `./custodyRollupId/${this.addressB}/${this.custodyRollupId}.json`) : path.join(__dirname, `./custodyRollupId/${this.addressA}/${this.custodyRollupId}.json`);
                const jsonData = JSON.parse(fs.readFileSync(filePath));
                jsonData.push(tx);
                fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
                return chainable;
            }
        };

        return chainable;
    }

    receipt() {
        const filePath = this.isA ? path.join(__dirname, `./custodyRollupId/${this.addressA}/${this.custodyRollupId}.json`) : path.join(__dirname, `./custodyRollupId/${this.addressB}/${this.custodyRollupId}.json`);
        const jsonData = JSON.parse(fs.readFileSync(filePath));
        const lastTx = jsonData[jsonData.length - 1];

        if (!lastTx) {
            throw new Error("No transaction to sign");
        }

        const address = this.isA ? this.addressA : this.addressB;
        const account = privateKeyToAccount(mockAccount.find(acc => acc.address === address).privateKey);
        const signature = account.signMessage({ message: JSON.stringify(lastTx.params) });

        lastTx.signatures = lastTx.signatures || [];
        lastTx.signatures.push(signature);

        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
        return this;
    }
}

function resetCustodyRollupIdFolder() {
    const directoryPath = path.join(__dirname, './custodyRollupId');
    fs.readdir(directoryPath, (err, files) => {
        if (err) throw new Error('Unable to scan directory: ' + err);
        files.forEach(file => {
            const filePath = path.join(directoryPath, file);
            fs.rmdir(filePath, { recursive: true }, (err) => {
                if (err) throw new Error('Unable to remove directory: ' + err);
            });
        });
    });
}

resetCustodyRollupIdFolder();
const addressA = mockAccount[0].publicKey;
const addressB = mockAccount[1].publicKey;
const custodyRollupId = getRollupBytes32(addressA, addressB, 1);
const rollupA = new CustodyRollupTree(addressA, addressB, custodyRollupId);
const rollupB = new CustodyRollupTree(addressB, addressA, custodyRollupId);
rollupA.auth(true, privateKeyToAccount(mockAccount[0].privateKey));
rollupB.auth(false, privateKeyToAccount(mockAccount[1].privateKey));

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
    .sign()
    .build()
    .send();

rollupB.receipt().send();

// Create a new transaction with specific parameters
rollupB.newTx("rfqFill/swap/open")
    .param("amount", "1000000000000000000")
    .param("price", "1000000000000000000")
    .param("rfqNonce", "0xA0")
    .param("timestamp", Date.now())
    .sign(addressB)
    .build()
    .send();

rollupA.receipt().send();

rollupA.newTx("custodyRollup/deposit/erc20")
    .eip712("TransferToCustodyRollupParams")
    .param("partyA", addressA)
    .param("partyB", addressB)
    .param("custodyRollupId", custodyRollupId)
    .param("collateralAmount", "10")
    .param("collateralToken", "0xB234567890123456789012345678901234567890")
    .param("expiration", Date.now() + 1000000)
    .param("timestamp", Date.now())
    .sign(addressA, true)
    .build()
    .send();






/* // solidity eip712 struct for deposit/erc20 eip712
     struct createCustodyRollupParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        address settlementAddress;
        bytes32 MA;
        bool isManaged;
        uint256 expiration;
        uint256 timestamp;
        uint256 nonce;
    }

    struct transferToCustodyRollupParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        uint256 collateralAmount;
        address collateralToken;
        uint256 expiration;
        uint256 timestamp;
        uint256 nonce;
    }
    
    struct transferFromCustodyRollupParams {
        bytes32 signatureA;
        bytes32 signatureB;
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        uint256 collateralAmount;
        address collateralToken;
        uint256 expiration;
        uint256 timestamp;
        uint256 nonce;
    }
*/