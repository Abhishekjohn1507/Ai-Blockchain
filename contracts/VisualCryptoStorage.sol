// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VisualCryptoStorage is Ownable, ReentrancyGuard {
    struct Share {
        string ipfsHash;
        uint256 timestamp;
        bool isValid;
    }

    mapping(address => mapping(uint256 => Share)) private shares;
    mapping(address => uint256) private shareCount;
    
    event ShareStored(address indexed user, uint256 indexed shareId, string ipfsHash);
    event ShareRevoked(address indexed user, uint256 indexed shareId);

    constructor() Ownable(msg.sender) {}

    function storeShare(string memory ipfsHash) public nonReentrant returns (uint256) {
        require(bytes(ipfsHash).length > 0, "Invalid IPFS hash");
        
        uint256 shareId = shareCount[msg.sender];
        shares[msg.sender][shareId] = Share({
            ipfsHash: ipfsHash,
            timestamp: block.timestamp,
            isValid: true
        });
        
        shareCount[msg.sender]++;
        emit ShareStored(msg.sender, shareId, ipfsHash);
        return shareId;
    }

    function getShare(address user, uint256 shareId) public view returns (string memory, uint256, bool) {
        require(msg.sender == owner() || msg.sender == user, "Unauthorized access");
        Share memory share = shares[user][shareId];
        require(share.isValid, "Share does not exist or was revoked");
        
        return (share.ipfsHash, share.timestamp, share.isValid);
    }

    function revokeShare(uint256 shareId) public nonReentrant {
        require(shares[msg.sender][shareId].isValid, "Share does not exist or was already revoked");
        shares[msg.sender][shareId].isValid = false;
        emit ShareRevoked(msg.sender, shareId);
    }

    function getShareCount(address user) public view returns (uint256) {
        return shareCount[user];
    }
} 