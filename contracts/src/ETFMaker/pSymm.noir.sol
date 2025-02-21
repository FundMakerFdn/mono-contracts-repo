// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "contracts/src/SettleMaker/interfaces/ISettlement.sol";

using SafeERC20 for IERC20;

contract pSymm is EIP712 {
    type IDispute is ISettlement;

    // I don't want to know if A did trade with B
    // I don't want to know, how much ERC20 in a custody
    // I don't want to know from wich custody / address the funds are coming from
    
    mapping(bytes32 => bytes32) private custodys;
    mapping(bytes32 => mapping(address => uint256)) public custodyBalances; // custodyId => token address => balance
    mapping(bytes32 => bool) private signatureClaimed;
    mapping(bytes32 => bytes32) private PPMs;
    mapping(bytes32 => uint8) private custodyState;
    // 1 PPM private key is shared inside PPM
    // 2 In case of dispute, we reveal PPM Pk that decode 
    mapping(bytes32 => mapping(uint256 => bytes)) public custodyMsg; // custodyId => token address => balance
    mapping(bytes32 => uint256) private custodyMsgLength;
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

    function addressToCustody(address sender, bytes32 _id, address _token, uint256 _amount, bytes signature) external {
        // @TODO verify EIP712 signature
        IERC20(_token).safeTransferFrom(sender, address(this), _amount);
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

    /// SettleMaker
/*
    event CustodyMsgPublished(bytes32 indexed _id, bytes _msg, uint256 _index);

    function publishCustodyMsg(bytes32 _id, bytes memory _msg) public { // no check, we verify offchain the trailer
        custodyMsg[_id][custodyMsg[_id]] = _msg; 
        custodyMsgLength[_id]++;
        // @TODO event
    }
*/
    function createDispute(bytes32 _id) external
    checkCustodyState(_id) {
        // who can create dispute is whitelisted in PPM
        custodyState[_id] = 2;
        // @TODO event
    }

    function executeDisputeSettlement() public { // SettleMaker address in the PPM
        if (settlementReRouting[_target] != 0){
            // transfer to new target
        } else {
            // normal transfer
        }
    }
/*
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
    */
    /// Read function

    function getBalance(bytes32 _id, address _token) external pure returns (uint256) {
        return custodyBalances[_id][_token];
    }
}

// @TODO self deploy custody from PPM   
