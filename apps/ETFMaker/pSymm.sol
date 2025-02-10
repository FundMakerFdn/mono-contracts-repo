// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../contracts/src/SettleMaker/interfaces/ISettlement.sol";

using SafeERC20 for IERC20;

contract pSymm is EIP712 {
	type IDispute is ISettlement;

    mapping(bytes32 => bytes32) private custodys;
    mapping(bytes32 => mapping(address => uint256)) public custodyBalances; // custodyId => token address => balance
    mapping(bytes32 => mapping(address => bool)) public smaAllowance; // custodyId => deployed SMA address => isAllowed
    mapping(bytes32 => bool) private signatureClaimed;
    mapping(bytes32 => uint256) public lastSMAUpdateTimestamp; // custodyId => timestamp
    mapping(bytes32 => bytes32) private PPMs;
    mapping(bytes32 => uint8) private custodyState;
    // 1 PPM private key is shared inside PPM
    // 2 In case of dispute, we reveal PPM Pk that decode 
    mapping(bytes32 => mapping(uint256 => bytes)) public custodyMsg; // custodyId => token address => balance
    mapping(bytes32 => uint256) private custodyMsgLenght;
    // SettleMaker
    mapping(bytes32 => IDispute) private disputes; // custodyId => Dispute
    constructor() EIP712("pSymm", "2.0") {}

    modifier checkCustodyState(bytes32 _id) {
        require(custodyState[_id] == 0, "State isn't 0");
        _;
    }

    modifier checkCustodyBalance(bytes32 _id, address _token, uint256 _amount) {
        require(custodyBalances[_id][_token] >= _amount, "Out of collateral");
        _;
    }

    function createCustody(bytes32 _ppm) external {
        require(_ppm == bytes(0), "PPM already created");
        custodys[_ppm] = _ppm;
        // @TODO update state
        // @TODO event
    }

    function updatePPM(bytes32 _id, bytes32 _ppm, uint256 _timestamp) external
	checkCustodyState(_id) {
        // check signature
        // check merkle
        require(_timestamp <= block.timestamp && _timestamp > lastSMAUpdateTimestamp[_id], "signature expired");
        PPMs[_id] = _ppm;
        // @TODO event
    }

    function addressToCustody(address sender, bytes32 _id, address _token, uint256 _amount, bytes signature) external {
        // @TODO verify EIP712 signature
		IERC20(_token).safeTransferFrom(sender, address(this), _amount);
        custodyBalances[_id][_token] += _amount;
        // @TODO event
    }

    function addressToCustody(bytes32 _id, address _token, uint256 _amount) external {
		IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        custodyBalances[_id][_token] += _amount;
        // @TODO event
    }

    function custodyToAddress(address _target, uint256 _id, address _token, uint256 _amount) external
	checkCustodyState(_id)
	checkCustodyBalance(_id, _token, _amount) {
        // check signature
        // check merkle
        IERC20(_token).safeTransfer(_target, _amount);
        custodyBalances[_id][_token] -= _amount;
        // @TODO event
    }

    function custodyToCustody(bytes32 _target, uint256 _id, address _token, uint256 _amount) external 
    checkCustodyState(_id)
    checkCustodyBalance(_id, _token, _amount) {
        // check signature
        // check merkle
        IERC20(_token).safeTransfer(_target, _amount);
        custodyBalances[_id][_token] -= _amount;
        custodyBalances[_target][_token] += _amount;
        // @TODO event
    }

    function custodyToSMA(address _smaAddress, uint256 _id, address _token, uint256 _amount) external 
    checkCustodyState(_id)
    checkCustodyBalance(_id, _token, _amount) {
        // check signature
        // check merkle
        require(smaAllowance[_id][_smaAddress] == true, "SMA not whitelisted");
        IERC20(_token).safeTransfer(_smaAddress, _amount);
        custodyBalances[_id][_token] -= _amount;
        // @TODO event
    }

    /// SettleMaker

    event CustodyMsgPublished(bytes32 indexed _id, bytes _msg, uint256 _index);

    function publishCustodyMsg(bytes32 _id, bytes memory _msg) public { // no check, we verify offchain the trailer
        custodyMsg[_id][custodyMsg[_id]] = _msg; 
        custodyMsgLenght[_id]++;
        // @TODO event
    }

    function createDispute(bytes32 _id) external
    checkCustodyState(_id) {
        // who can create dispute is whitelisted in PPM
        custodyState[_id] = 2;
        // @TODO event
    }

    function earlyAgreement() external {
        // 1. sign offchain all action to execut after early agreement
        // 2. sign and push early aggrement message ( ECDSA public key in PPM )
        // 3. push transfer signed in 1
    }

    mapping( bytes32 => mapping( address => address)) private settlementReRouting;
    function instantWithdraw() public {
        // buy the right of redirecting claims from a dispute
    }

    function executeDisputeSettlement() public { // SettleMaker address in the PPM
        if (settlementReRouting[_target] != 0){
            // transfer to new target
        } else {
            // normal transfer
        }
    }

    /// Provisional Settlement
    // @notice multiple provisional settlement can be emmited on the same custody, but only 1 need to not be revoked
    //          If more than 1 provisional settlement is live during vote phase, report vote
    //          If no proposal, dispute is considered on hold
    //          Submit and revoke are only considered if called by a validator
    //          Any user can propose a submit though discuss
    //          Solver who spam submit will be slashed by other SettleMaker validators
    function submitProvisional(bytes32 _id, bytes _calldata, bytes _msg) external { emit submitProvisional(_id, _calldata, _msg, block.timestamp);}
    function revokeProvisional(bytes32 _id, bytes _calldata, bytes _msg) external { emit revokeProvisional(_id, _calldata, _msg, block.timestamp);}
    function discussProvisional(bytes32 _id, bytes _msg) external { emit discussProvisional(_id, _msg, block.timestamp);}  // submit arweave merkle leaves here
    
    /// Read function

    function getBalance(bytes32 _id, address _token) external pure returns (uint256) {
        return custodyBalances[_id][_token];
    }
}

// @TODO self deploy custody from PPM   
