// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "../../../SettleMaker/Settlement.sol";
import "../../../SettleMaker/interfaces/IValidatorSettlement.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Validator Settlement Contract
contract ValidatorSettlement is IValidatorSettlement, Settlement {
    using SafeERC20 for IERC20;
    
    struct ValidatorParameters {
        address validator;
        uint256 requiredSymmAmount;
        bool isAdd; // true = add validator, false = remove
    }

    address private immutable deployer;

    bytes32 private constant VALIDATOR_SETTLEMENT_TYPEHASH = 
        keccak256("ValidatorSettlement(address validator,uint256 requiredSymmAmount,bool isAdd)");

    // Track active validators and their staked amounts
    mapping(address => uint256) public validatorStakes;
    mapping(address => bool) public isActiveValidator;
    // Store validator parameters per settlement
    mapping(bytes32 => ValidatorParameters) private validatorParameters;

    constructor(
        string memory name,
        string memory version
    ) Settlement(address(0), name, version) {
		deployer = msg.sender;
	}

    function setSettleMaker(address _settleMaker) external {
        require(msg.sender == deployer, "Only deployer can set");
        require(settleMaker == address(0), "SettleMaker already set");
        require(_settleMaker != address(0), "Invalid SettleMaker address");
        
        settleMaker = _settleMaker;
    }

    function createValidatorSettlement(
        address validator,
        uint256 requiredSymmAmount,
        bool isAdd
    ) external returns (bytes32) {
        bytes32 settlementId = _createSettlementId(abi.encode(
            validator,
            requiredSymmAmount,
            isAdd
        ));
        
        settlements[settlementId] = 0;

        ValidatorParameters memory params = ValidatorParameters({
            validator: validator,
            requiredSymmAmount: requiredSymmAmount,
            isAdd: isAdd
        });

        validatorParameters[settlementId] = params;
        
        emit SettlementCreated(settlementId, msg.sender, address(this));
        
        return settlementId;
    }

    // Override executeSettlement to handle validator updates
    function executeSettlement(
        uint256 batchNumber,
        bytes32 settlementId,
        bytes32[] calldata merkleProof
    ) public override(ISettlement, Settlement) {
        super.executeSettlement(batchNumber, settlementId, merkleProof);

        ValidatorParameters memory params = validatorParameters[settlementId];
        
        if (params.isAdd) {
            // Add validator
            require(!isActiveValidator[params.validator], "Already a validator");
            
            // Transfer and lock SYMM tokens
            IERC20(getSymmToken()).safeTransferFrom(
                params.validator,
                address(this),
                params.requiredSymmAmount
            );
            
            validatorStakes[params.validator] = params.requiredSymmAmount;
            isActiveValidator[params.validator] = true;
        } else {
            // Remove validator
            require(isActiveValidator[params.validator], "Not a validator");
            
            // Return staked SYMM
            IERC20(getSymmToken()).safeTransfer(
                params.validator,
                validatorStakes[params.validator]
            );
            
            delete validatorStakes[params.validator];
            isActiveValidator[params.validator] = false;
        }
    }

    // Required interface method for SettleMaker
    function verifyValidator(address account) external view returns (bool) {
        return isActiveValidator[account];
    }

    function getValidatorParameters(bytes32 settlementId) external view returns (ValidatorParameters memory) {
        return validatorParameters[settlementId];
    }

    function calculateValidatorHash(ValidatorParameters memory params) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            VALIDATOR_SETTLEMENT_TYPEHASH,
            params.validator,
            params.requiredSymmAmount,
            params.isAdd
        ));
        return _hashTypedDataV4(structHash);
    }
}
