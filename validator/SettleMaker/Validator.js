const BaseValidator = require('./BaseValidator');
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const { parseEther } = require("viem");

class Validator extends BaseValidator {
    constructor(publicClient, walletClient, contracts, config, isMainValidator = false) {
        super(publicClient, walletClient, contracts, config, isMainValidator);
        this.isWhitelisted = false;
    }

    async start() {
        // Check if already whitelisted
        this.isWhitelisted = await this.contracts.settleMaker.read.isValidator([
            this.walletClient.account.address
        ]);

        if (!this.isWhitelisted) {
            await this.submitWhitelistSettlement();
        }

        // Continue with normal validator operation
        await super.start();
    }

    async submitWhitelistSettlement() {
        console.log("Submitting validator whitelist settlement...");

        // Create validator whitelist settlement
        const tx = await this.contracts.validatorSettlement.write.createValidatorSettlement(
            [
                this.walletClient.account.address,
                parseEther("1000"), // Required SYMM amount
                true // isAdd = true
            ],
            {
                account: this.walletClient.account
            }
        );

        const settlementId = await super.getSettlementIdFromReceipt(tx, this.contracts.validatorSettlement);

        // Wait for main validator to include this settlement
        console.log(`Waiting for validator whitelist settlement ${settlementId} to be processed...`);
        
        // Poll until whitelisted
        while (!this.isWhitelisted && !this.shouldStop) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            this.isWhitelisted = await this.contracts.settleMaker.read.isValidator([
                this.walletClient.account.address
            ]);
        }

        if (this.isWhitelisted) {
            console.log("Successfully whitelisted as validator");
        }
    }
}

module.exports = Validator;
