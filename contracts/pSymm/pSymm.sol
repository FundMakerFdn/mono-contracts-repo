// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "contracts/pSymm/settlement/pSymmSettlement.sol" as pSymmSettlement;
import "contracts/pSymm/lib/EIP712SignatureChecker.sol"; // Import the library
import "hardhat/console.sol";


contract pSymm is EIP712 {


    struct CustodyRollup {
        address partyA;
        address partyB;
        uint256 custodyRollupId;
        address settlementAddress;
        bytes32 MA;
        bool isManaged;
        uint8 state; // 0: open, 1: inSettlement
        uint256 timestamp;
        uint256 nonce;
    }

    event CustodyRollupCreated(uint256 indexed custodyRollupId, address indexed partyA, address indexed partyB, address settlementAddress);
    event TransferToCustodyRollup(bytes32 indexed custodyRollupId, address indexed collateralToken, uint256 amount, address indexed sender);
    event WithdrawFromCustodyRollup(bytes32 indexed custodyRollupId, address indexed collateralToken, uint256 amount, address indexed receiver);
    event MAUpdated(bytes32 indexed custodyRollupId, bytes32 MA);
    event SettlementOpened(bytes32 indexed custodyRollupId);
    event Deposit(address indexed collateralToken, uint256 amount);
    event Withdraw(address indexed collateralToken, uint256 amount);
    event InstantWithdraw(bytes32 indexed custodyRollupId, address indexed instantWithdraw);
    event SettlementWithdrawEvent(bytes32 indexed custodyRollupId, address indexed collateralToken, uint256 amount, bytes32 indexed custodyRollupIdReceiver);
    mapping(bytes32 => CustodyRollup) private custodyRollups;
    mapping(bytes32 => mapping(address => uint256)) private custodyRollupBalances; // custodyRollupId => token address => balance
    mapping(bytes32 => bool) private signatureClaimed;
    

    constructor() EIP712("pSymm", "1.0") {}

    modifier checkAndClaimSignatures(bytes32 signatureA, bytes32 signatureB) {
        require(signatureClaimed[signatureA] == false && signatureClaimed[signatureB] == false, "Signature already claimed");
        signatureClaimed[signatureA] = true;
        signatureClaimed[signatureB] = true;
        _;
    }

    modifier checkExpiration(uint256 expiration) {
        require(block.timestamp < expiration, "Transaction expired");
        _;
    }

    modifier checkCustodialRollupOwner(address partyA, address partyB, uint256 _custodyRollupId) {
        bytes32 custodyRollupId = keccak256(abi.encodePacked(partyA, partyB, _custodyRollupId));
        require(custodyRollups[custodyRollupId].state == 0, "Custodial rollup already closed");
        require(partyA != partyB, "Party A and Party B cannot be the same");
        require(custodyRollups[custodyRollupId].partyA == partyA && custodyRollups[custodyRollupId].partyB == partyB, "Invalid custodial rollup owner");
        _;
    }

    function _transferCustodyRollupBalance(
        bytes32 fromCustodyRollupId,
        bytes32 toCustodyRollupId,
        address collateralToken,
        uint256 amount
    ) private {
        require(custodyRollupBalances[fromCustodyRollupId][collateralToken] >= amount, "Insufficient balance");

        custodyRollupBalances[fromCustodyRollupId][collateralToken] -= amount;
        custodyRollupBalances[toCustodyRollupId][collateralToken] += amount;
    }

    // @notice Create a new CustodyRollup with EIP712 signature of counterparty
    function createCustodyRollup(EIP712SignatureChecker.createCustodyRollupParams memory params) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyCreateCustodyRollup(params), "Invalid signature");

        bytes32 custodyRollupId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyRollupId));

        custodyRollups[custodyRollupId] = CustodyRollup(params.partyA, params.partyB, params.custodyRollupId, params.settlementAddress, params.MA, params.isManaged, 0);

        emit CustodyRollupCreated(params.custodyRollupId, params.partyA, params.partyB, params.settlementAddress);
    }

    function transferToCustodyRollup(EIP712SignatureChecker.transferToCustodyRollupParams memory params, uint256 _senderCustodyRollupId) 
        external 
        checkAndClaimSignatures(params.signSender, params.signReceiver) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyTransferToCustodyRollup(params), "Invalid signature");
        address sender = params.isA ? params.partyA : params.partyB;
        bytes32 custodyRollupId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyRollupId));
        bytes32 senderCustodyRollupId = keccak256(abi.encodePacked(sender, sender, _senderCustodyRollupId));

        _transferCustodyRollupBalance(senderCustodyRollupId, custodyRollupId, params.collateralToken, params.amount);

        emit TransferToCustodyRollup(custodyRollupId, params.collateralToken, params.amount, params.sender);
    }

    // @notice Withdraw from CustodyRollup, all withdraws requires EIP712 signature of counterparty    
    function transferFromCustodyRollup(EIP712SignatureChecker.transferFromCustodyRollupParams memory params, uint256 _receiverCustodyRollupId) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyTransferFromCustodyRollup(params), "Invalid signature");

        CustodyRollup storage custodyRollup = custodyRollups[params.custodyRollupId];
        address receiver = params.isA ? params.partyB : params.partyA;
        bytes32 receiverCustodyRollupId = keccak256(abi.encodePacked(receiver, receiver, _receiverCustodyRollupId));

        _transferCustodyRollupBalance(receiverCustodyRollupId, params.custodyRollupId, params.collateralToken, params.amount);

        emit WithdrawFromCustodyRollup(params.custodyRollupId, params.collateralToken, params.amount, receiver);
    }

    function updateMA(EIP712SignatureChecker.updateMAParams memory params) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyUpdateMA(params), "Invalid signature");
       
        custodyRollups[params.custodyRollupId].MA = params.MA;

        emit MAUpdated(params.custodyRollupId, params.MA);
    }

    // @notice Open a settlement by calling the openSettlement function in pSymmSettlement contract
    function openSettlement(bytes32 custodyRollupId, bytes32 merkleRoot, bool isA) external {
        CustodyRollup storage custodyRollup = custodyRollups[custodyRollupId];
        require(custodyRollup.state == 0, "Settlement already open");
        require(msg.sender == custodyRollup.partyA || msg.sender == custodyRollup.partyB, "Invalid Caller");
        custodyRollup.state = 1;

        pSymmSettlement.pSymmSettlement pSymmSettlementContract = pSymmSettlement.pSymmSettlement(custodyRollups[custodyRollupId].settlementAddress);
    
        // Call openSettlement with necessary parameters
        pSymmSettlementContract.openSettlement(
            custodyRollupId,
            merkleRoot,
            isA
        );  

        emit SettlementOpened(custodyRollupId);
    }

    function deposit(address collateralToken, uint256 collateralAmount, uint256 _custodyRollupId) external {
        bytes32 custodyRollupId = keccak256(abi.encodePacked(msg.sender, msg.sender, _custodyRollupId));
        // safe transfer from user
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);
        custodyRollupBalances[custodyRollupId][collateralToken] += collateralAmount;

        emit Deposit(collateralToken, collateralAmount);
    }

    function withdraw(address collateralToken, uint256 collateralAmount, uint256 _custodyRollupId) external {
        bytes32 custodyRollupId = keccak256(abi.encodePacked(msg.sender, msg.sender, _custodyRollupId));
        // safe transfer to user
        IERC20(collateralToken).safeTransfer(msg.sender, collateralAmount);
        custodyRollupBalances[custodyRollupId][collateralToken] -= collateralAmount;

        emit Withdraw(collateralToken, collateralAmount);
    }

    // @notice Withdraw from settlement, only the settlement contract can call this function
    function settlementWithdraw(address collateralToken, uint256 collateralAmount, bytes32 custodyRollupTarget, bytes32 custodyRollupIdReceiver) external {
        require(custodyRollups[custodyRollupTarget].state == 1, "Settlement not in settlement state");
        require(msg.sender == custodyRollups[custodyRollupTarget].settlementAddress, "Invalid Caller");

        _transferCustodyRollupBalance(custodyRollupTarget, custodyRollupIdReceiver, collateralToken, collateralAmount);

        emit SettlementWithdrawEvent(custodyRollupTarget, collateralToken, collateralAmount, custodyRollupIdReceiver);
    }
    
    // @notice Withdraw from settlement, only the settlement contract can call this function
    function settlementWithdraw(bytes32 custodyRollupTarget, address instantWithdraw, address replacedParty, bool isA) external {

        require(custodyRollups[custodyRollupTarget].state == 1, "Settlement not in settlement state");
        require(msg.sender == custodyRollups[custodyRollupTarget].settlementAddress, "Invalid Caller");
        if (isA) {
            require(replacedParty == custodyRollups[custodyRollupTarget].partyA, "Invalid replaced party"); 
            custodyRollups[custodyRollupTarget].partyA = instantWithdraw;
        } else {
            require(replacedParty == custodyRollups[custodyRollupTarget].partyB, "Invalid replaced party");
            custodyRollups[custodyRollupTarget].partyB = instantWithdraw;
        }

        emit InstantWithdraw(custodyRollupTarget, instantWithdraw);
    }
}
