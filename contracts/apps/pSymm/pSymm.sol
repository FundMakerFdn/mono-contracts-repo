// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./PSymmSettlement.sol";
import "hardhat/console.sol";

contract pSymm is EIP712 {

    struct subAccount {
        address partyA;
        address partyB;
        uint256 subAccountId;
        uint256 collateralAmount;
        address collateralToken;
        address settlementAddress;
        bytes32 MA_A;
        bytes32 MA_B;
        bool isManaged;
        uint8 state;
    }

    struct createSubAccountParams {
        address partyA;
        address partyB;
        uint256 subAccountId;
        uint256 IM_A;
        uint256 IM_B;
        uint256 collateralAmount;
        address collateralToken;
        address settlementAddress;
        bytes32 MA_A;
        bytes32 MA_B;
        bool isManaged;
    }

    bytes32 private constant CREATE_SUBACCOUNT_TYPEHASH = keccak256(
        "createSubAccountParams(address partyA,address partyB,uint256 subAccountId,uint256 IM_A,uint256 IM_B,uint256 collateralAmount,address collateralToken)"
    );


    mapping(bytes32 => subAccount) private subAccounts;
    mapping(address => mapping(address => uint256)) private balances; // user => collateralToken => balance

    constructor() EIP712("pSymm", "1") {}

    // @notice Create a new subaccount with EIP712 signature of counterparty
    function createSubAccount(createSubAccountParams memory params, bytes memory signature) external {
        bytes32 structHash = keccak256(
            abi.encode(
                CREATE_SUBACCOUNT_TYPEHASH,
                params.partyA,
                params.partyB,
                params.subAccountId,
                params.IM_A,
                params.IM_B,
                params.collateralAmount,
                params.collateralToken,
                params.settlementAddress,
                params.MA_A,
                params.MA_B,
                params.isManaged
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);

        require(signer == params.partyB, "Invalid signature");

        bytes32 subAccountId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.subAccountId));

        // check balances
        require(balances[params.collateralToken][params.partyA] >= params.IM_A, "Insufficient balance");
        require(balances[params.collateralToken][params.partyB] >= params.IM_B, "Insufficient balance");
        // safe transfer from balances
        balances[params.collateralToken][params.partyA] -= params.IM_A;
        balances[params.collateralToken][params.partyB] -= params.IM_B;

        subAccounts[subAccountId] = subAccount(params.partyA, params.partyB, params.subAccountId, params.IM_A + params.IM_B, params.collateralToken, params.settlementAddress, params.MA_A, params.MA_B, params.isManaged, 0);

        emit SubAccountCreated(params.subAccountId, params.partyA, params.partyB, params.collateralToken, params.IM_A , params.IM_B, params.settlementAddress);
    }

    function transferToSubAccount(bytes32 subAccountId, address collateralToken, uint256 amount) external {
        // check balances
        require(balances[collateralToken][msg.sender] >= amount, "Insufficient balance");
        // safe transfer from user
        balances[collateralToken][msg.sender] -= amount;
        subAccounts[subAccountId].collateralAmount += amount;

        emit TransferToSubAccount(subAccountId, collateralToken, amount);
    }

    // @notice Withdraw from subaccount, all withdraws requires EIP712 signature of counterparty    
    function withdrawFromSubAccount(bytes32 subAccountId, uint256 amount_A, uint256 amount_B, bytes memory signature) external {
        subAccount storage subAccount = subAccounts[subAccountId];

        // verify EIP712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                WITHDRAW_FROM_SUBACCOUNT_TYPEHASH,
                subAccount.partyA,
                subAccount.partyB,
                subAccount.subAccountId,
                amount_A,
                amount_B
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);

        require(( signer == subAccount.partyB && msg.sender == subAccount.partyA ) || ( signer == subAccount.partyA && msg.sender == subAccount.partyB ), "Invalid signature");

        // verify balance
        require(subAccount.collateralAmount >= amount_A + amount_B, "Insufficient balance");

        // safe transfer to user
        subAccount.collateralAmount -= amount_A + amount_B;
        balances[subAccount.collateralToken][subAccount.partyA] += amount_A;
        balances[subAccount.collateralToken][subAccount.partyB] += amount_B;

        emit WithdrawFromSubAccount(subAccountId, amount_A, amount_B);
    }

    function updateMA(bytes32 subAccountId, bytes32 MA) external {
        if (msg.sender == subAccounts[subAccountId].partyA) {
            subAccounts[subAccountId].MA_A = MA;
        } else if (msg.sender == subAccounts[subAccountId].partyB) {
            subAccounts[subAccountId].MA_B = MA;
        }
        emit MAUpdated(subAccountId, MA);
    }

    // @notice Open a settlement by calling the openSettlement function in pSymmSettlement contract
    function openSettlement(bytes32 subAccountId) external {
        require(subAccounts[subAccountId].state == 0, "Settlement already open");
        subAccounts[subAccountId].state = 1;

        pSymmSettlement pSymmSettlementContract = pSymmSettlement(subAccounts[subAccountId].settlementAddress);
        IERC20(subAccounts[subAccountId].collateralToken).safeApprove(address(pSymmSettlementContract), subAccounts[subAccountId].collateralAmount);

        // Call openSettlement with necessary parameters
        pSymmSettlementContract.openSettlement(
            this.address, 
            subAccounts[subAccountId].partyA, 
            subAccounts[subAccountId].partyB, 
            subAccounts[subAccountId].subAccountId,
            subAccounts[subAccountId].collateralAmount, 
            subAccounts[subAccountId].collateralToken, 
            subAccounts[subAccountId].MA_A, 
            subAccounts[subAccountId].MA_B, 
            subAccounts[subAccountId].isManaged
            );  

        emit SettlementOpened(subAccountId);
    }

    function deposit(address collateralToken, uint256 collateralAmount) external {
        // safe transfer from user
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);
        balances[collateralToken][msg.sender] += collateralAmount;

        emit Deposit(collateralToken, collateralAmount);
    }

    function withdraw(address collateralToken, uint256 collateralAmount) external {
        // safe transfer to user
        IERC20(collateralToken).safeTransfer(msg.sender, collateralAmount);
        balances[collateralToken][msg.sender] -= collateralAmount;

        emit Withdraw(collateralToken, collateralAmount);
    }



}
