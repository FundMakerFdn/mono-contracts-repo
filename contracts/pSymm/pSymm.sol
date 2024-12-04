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

using SafeERC20 for IERC20;

contract pSymm is EIP712 {


    struct Custody {
        address partyA;
        address partyB;
        uint256 custodyId;
        address settlementAddress;
        bytes32 MA;
        bool isManaged;
        uint8 type; // 0: personal, 1: billateral, 2: settlement
        uint256 timestamp;
        bytes32 nonce;
    }

    event CustodyCreated(uint256 indexed CustodyId, address indexed partyA, address indexed partyB, address settlementAddress);
    event TransferToCustody(bytes32 indexed custodyId, address indexed collateralToken, uint256 amount, address indexed sender);
    event WithdrawFromCustody(bytes32 indexed custodyId, address indexed collateralToken, uint256 amount, address indexed receiver);
    event MAUpdated(bytes32 indexed custodyId, bytes32 MA);
    event SettlementOpened(bytes32 indexed custodyId);
    event Deposit(address indexed collateralToken, uint256 amount);
    event Withdraw(address indexed collateralToken, uint256 amount);
    event InstantWithdraw(bytes32 indexed custodyId, address indexed instantWithdraw);
    event SettlementWithdrawEvent(bytes32 indexed custodyId, address indexed collateralToken, uint256 amount, bytes32 indexed custodyIdReceiver);

    mapping(bytes32 => custody) private custodys;
    mapping(bytes32 => mapping(address => uint256)) public custodyBalances; // custodyId => token address => balance
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

    modifier checkCustodyOwner(address partyA, address partyB, uint256 _custodyId) {
        bytes32 custodyId = keccak256(abi.encodePacked(partyA, partyB, _custodyId));
        require(custodys[custodyId].type == 0, "Custody already closed"); // @flow to delete ?
        require(partyA != partyB, "Party A and Party B cannot be the same"); // @flow to delete
        require(custodys[custodyId].partyA == partyA && custodys[custodyId].partyB == partyB, "Invalid custodial rollup owner");
        _;
    }

    function _transferCustodyBalance(
        bytes32 FromCustodyId,
        bytes32 ToCustodyId,
        address collateralToken,
        uint256 collateralAmount
    ) private {
        require(custodyBalances[FromCustodyId][collateralToken] >= collateralAmount, "Insufficient balance");

        custodyBalances[FromCustodyId][collateralToken] -= collateralAmount;
        custodyBalances[ToCustodyId][collateralToken] += collateralAmount;
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

    // @notice Create a new custody with EIP712 signature of counterparty
    function CreateCustody(EIP712SignatureChecker.createCustodyParams memory params) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyId)
    {
        require(EIP712SignatureChecker.verifyCreateCustodyEIP712(params), "Invalid signature");

        bytes32 custodyId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyId));

        custodys[custodyId] = custody(
            params.partyA, 
            params.partyB, 
            params.custodyId, 
            params.settlementAddress, 
            params.MA, 
            params.isManaged, 
            0, 
            block.timestamp, 
            params.nonce
        );

        emit custodyCreated(params.custodyId, params.partyA, params.partyB, params.settlementAddress);
    }

    function _handleTransferToCustody(
        address partyA,
        address partyB,
        uint256 custodyId,
        address collateralToken,
        uint256 collateralAmount,
        bool isA,
        uint256 _senderCustodyId
    ) internal {
        address sender = isA ? partyA : partyB;
        bytes32 custodyId_ = keccak256(abi.encodePacked(partyA, partyB, custodyId));
        bytes32 senderCustodyId = keccak256(abi.encodePacked(sender, sender, _senderCustodyId));

        _transferCustodyBalance(senderCustodyId, custodyId_, collateralToken, collateralAmount);

        emit TransferToCustody(custodyId_, collateralToken, collateralAmount, sender);
    }


    // @notice Withdraw from custody, all withdraws requires EIP712 signature of counterparty
    // TODO if isManaged, open a dispute with merkle root
    function transferToCustody(EIP712SignatureChecker.transferToCustodyParams memory params, uint256 _senderCustodyId) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyId)
    {
        bool isA = _getIsA(params.nonce);
        require(EIP712SignatureChecker.verifyTransferToCustodyEIP712(params), "Invalid signature");
        
        //bytes32 FromCustodyId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyId));
        //address receiver = isA ? params.partyB : params.partyA;
        //address receiver = isA ? params.partyB : params.partyA;

        //require(custodys[FromCustodyId].isManaged == false, "Custodial rollup is not managed");
        //_transferCustodyBalance(FromCustodyId, _receiverCustodyId, params.collateralToken, params.collateralAmount);

        _handleTransferToCustody(
            params.partyA,
            params.partyB,
            params.custodyId,
            params.collateralToken,
            params.collateralAmount,
            isA,
            _senderCustodyId
        );
    }

    function updateMA(EIP712SignatureChecker.updateMAParams memory params) 
        external 
        checkAndClaimSignatures(params.signatureA, params.signatureB) 
        checkExpiration(params.expiration) 
        checkCustodialRollupOwner(params.partyA, params.partyB, params.custodyId)
    {
        bytes32 custodyId = keccak256(abi.encodePacked(params.partyA, params.partyB, params.custodyId));
        require(EIP712SignatureChecker.verifyUpdateMAEIP712(params), "Invalid signature");
       
        custodys[custodyId].MA = params.MA;

        emit MAUpdated(custodyId, params.MA);
    }

    // @notice Open a settlement by calling the openSettlement function in pSymmSettlement contract
    function openSettlement(bytes32 custodyId, bytes32 merkleRoot, bool isA) external {
        custody storage custody = custodys[custodyId];
        require(custody.type == 1, "Settlement already open");
        require(msg.sender == custody.partyA || msg.sender == custody.partyB, "Invalid Caller");
        custody.type = 2;

        pSymmSettlement.pSymmSettlement pSymmSettlementContract = pSymmSettlement.pSymmSettlement(custodys[custodyId].settlementAddress);
    
        pSymmSettlementContract.openSettlement(
                custody.partyA,
                custody.partyB,
                custodyId,
                merkleRoot,
                isA
            );

        emit SettlementOpened(custodyId);
    }

    function deposit(address collateralToken, uint256 collateralAmount, uint256 _custodyId) external {
        bytes32 custodyId = keccak256(abi.encodePacked(msg.sender, msg.sender, _custodyId));
        // safe transfer from user
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);
        custodyBalances[custodyId][collateralToken] += collateralAmount;

        emit Deposit(collateralToken, collateralAmount);
    }

    function withdraw(address collateralToken, uint256 collateralAmount, uint256 _custodyId) external {
        bytes32 custodyId = keccak256(abi.encodePacked(msg.sender, msg.sender, _custodyId));
        // safe transfer to user
        IERC20(collateralToken).safeTransfer(msg.sender, collateralAmount);
        custodyBalances[custodyId][collateralToken] -= collateralAmount;

        emit Withdraw(collateralToken, collateralAmount);
    }

    // @notice Withdraw from settlement, only the settlement contract can call this function
    function settlementWithdraw(address collateralToken, uint256 collateralAmount, bytes32 custodyTarget, bytes32 custodyIdReceiver) external {
        require(custodys[custodyTarget].type == 2, "Settlement not in settlement type");
        require(msg.sender == custodys[custodyTarget].settlementAddress, "Invalid Caller");

        _transferCustodyBalance(custodyTarget, custodyIdReceiver, collateralToken, collateralAmount);

        emit SettlementWithdrawEvent(custodyTarget, collateralToken, collateralAmount, custodyIdReceiver);
    }
    
    // @notice Instant withdraw from settlement, only the settlement contract can call this function
    function settlementWithdraw(bytes32 custodyTarget, address instantWithdraw, address replacedParty, bool isA) external {

        require(custodys[custodyTarget].type == 2, "Settlement not in settlement type");
        require(msg.sender == custodys[custodyTarget].settlementAddress, "Invalid Caller");
        if (isA) {
            require(replacedParty == custodys[custodyTarget].partyA, "Invalid replaced party"); 
            custodys[custodyTarget].partyA = instantWithdraw;
        } else {
            require(replacedParty == custodys[custodyTarget].partyB, "Invalid replaced party");
            custodys[custodyTarget].partyB = instantWithdraw;
        }

        emit InstantWithdraw(custodyTarget, instantWithdraw);
    }

    // Read functions
    function getCustody(bytes32 custodyId) external view returns (custody memory) {
        return custodys[custodyId];
    }

    function getCustodyBalance(bytes32 custodyId, address collateralToken) external view returns (uint256) {
        return custodyBalances[custodyId][collateralToken];
    }

    function getSignatureClaimed(bytes32 signature) external view returns (bool) {
        return signatureClaimed[signature];
    }

    function getRollupBytes32(address a, address b, uint256 id) pure external returns (bytes32) {
        return keccak256(abi.encodePacked(a, b, id));
    }
}
