// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "contracts/pSymm/settlement/pSymmSettlement.sol" as pSymmSettlement;
import "contracts/pSymm/EIP712SignatureChecker.sol"; // Import the library
import "hardhat/console.sol";

using SafeERC20 for IERC20;

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
        bytes32 nonce;
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
    mapping(bytes32 => mapping(address => uint256)) public custodyRollupBalances; // custodyRollupId => token address => balance
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
        uint256 collateralAmount
    ) private {
        require(custodyRollupBalances[fromCustodyRollupId][collateralToken] >= collateralAmount, "Insufficient balance");

        custodyRollupBalances[fromCustodyRollupId][collateralToken] -= collateralAmount;
        custodyRollupBalances[toCustodyRollupId][collateralToken] += collateralAmount;
    }

    /**
     * @dev Derives the isA flag by examining the first hexadecimal digit of the nonce.
     *      If the first digit is 0, isA is true; if it's 1, isA is false.
     * @param nonce The nonce from which to derive the isA flag.
     * @return isA The derived boolean value.
     */
    function _getIsA(bytes32 nonce) internal pure returns (bool isA) {
        uint8 firstNibble = uint8(nonce[0] >> 4); // Extract first nibble
        require(firstNibble == 0xA || firstNibble == 0xB, "Invalid nonce first nibble");
        return firstNibble == 0xA;
    }

    // @notice Create a new CustodyRollup with EIP712 signature of counterparty
    function createCustodyRollup(EIP712SignatureChecker.createCustodyRollupParams memory params) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        require(EIP712SignatureChecker.verifyCreateCustodyRollupEIP712(params), "Invalid signature");

        bytes32 custodyRollupId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyRollupId));

        custodyRollups[custodyRollupId] = CustodyRollup(
            params.partyA, 
            params.partyB, 
            params.custodyRollupId, 
            params.settlementAddress, 
            params.MA, 
            params.isManaged, 
            0, 
            block.timestamp, 
            params.nonce
        );

        emit CustodyRollupCreated(params.custodyRollupId, params.partyA, params.partyB, params.settlementAddress);
    }

    function _handleTransferToCustodyRollup(
        address partyA,
        address partyB,
        uint256 custodyRollupId,
        address collateralToken,
        uint256 collateralAmount,
        bool isA,
        uint256 _senderCustodyRollupId
    ) internal {
        address sender = isA ? partyA : partyB;
        bytes32 custodyRollupId_ = keccak256(abi.encodePacked(partyA, partyB, custodyRollupId));
        bytes32 senderCustodyRollupId = keccak256(abi.encodePacked(sender, sender, _senderCustodyRollupId));

        _transferCustodyRollupBalance(senderCustodyRollupId, custodyRollupId_, collateralToken, collateralAmount);

        emit TransferToCustodyRollup(custodyRollupId_, collateralToken, collateralAmount, sender);
    }

    function transferToCustodyRollup(EIP712SignatureChecker.transferToCustodyRollupParams memory params, uint256 _senderCustodyRollupId) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        bool isA = _getIsA(params.nonce);
        require(EIP712SignatureChecker.verifyTransferToCustodyRollupEIP712(params), "Invalid signature");
        
        _handleTransferToCustodyRollup(
            params.partyA,
            params.partyB,
            params.custodyRollupId,
            params.collateralToken,
            params.collateralAmount,
            isA,
            _senderCustodyRollupId
        );
    }

    // @notice Withdraw from CustodyRollup, all withdraws requires EIP712 signature of counterparty
    // TODO if isManaged, open a dispute with merkle root
    function transferFromCustodyRollup(EIP712SignatureChecker.transferFromCustodyRollupParams memory params, bytes32 _receiverCustodyRollupId) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        bool isA = _getIsA(params.nonce);

        require(EIP712SignatureChecker.verifyTransferFromCustodyRollupEIP712(params), "Invalid signature");
        bytes32 fromCustodyRollupId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyRollupId));
        address receiver = isA ? params.partyB : params.partyA;

        require(custodyRollups[fromCustodyRollupId].isManaged == false, "Custodial rollup is not managed");
        _transferCustodyRollupBalance(fromCustodyRollupId, _receiverCustodyRollupId, params.collateralToken, params.collateralAmount);
        

        emit WithdrawFromCustodyRollup(_receiverCustodyRollupId, params.collateralToken, params.collateralAmount, receiver);
    }



    function updateMA(EIP712SignatureChecker.updateMAParams memory params) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyRollupId)
    {
        bytes32 custodyRollupId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyRollupId));
        require(EIP712SignatureChecker.verifyUpdateMAEIP712(params), "Invalid signature");
       
        custodyRollups[custodyRollupId].MA = params.MA;

        emit MAUpdated(custodyRollupId, params.MA);
    }

    // @notice Open a settlement by calling the openSettlement function in pSymmSettlement contract
    function openSettlement(bytes32 custodyRollupId, bytes32 merkleRoot, bool isA) external {
        CustodyRollup storage custodyRollup = custodyRollups[custodyRollupId];
        require(custodyRollup.state == 0, "Settlement already open");
        require(msg.sender == custodyRollup.partyA || msg.sender == custodyRollup.partyB, "Invalid Caller");
        custodyRollup.state = 1;

        pSymmSettlement.pSymmSettlement pSymmSettlementContract = pSymmSettlement.pSymmSettlement(custodyRollups[custodyRollupId].settlementAddress);
    
        pSymmSettlementContract.openSettlement(
                custodyRollup.partyA,
                custodyRollup.partyB,
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
    
    // @notice Instant withdraw from settlement, only the settlement contract can call this function
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

    // Read functions
    function getCustodyRollup(bytes32 custodyRollupId) external view returns (CustodyRollup memory) {
        return custodyRollups[custodyRollupId];
    }

    function getCustodyRollupBalance(bytes32 custodyRollupId, address collateralToken) external view returns (uint256) {
        return custodyRollupBalances[custodyRollupId][collateralToken];
    }

    function getSignatureClaimed(bytes32 signature) external view returns (bool) {
        return signatureClaimed[signature];
    }

    function getRollupBytes32(address a, address b, uint256 id) pure external returns (bytes32) {
        return keccak256(abi.encodePacked(a, b, id));
    }
}
