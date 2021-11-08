// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Generation1s {
    function balanceOf(address owner) public view virtual returns (uint256) {}
}

contract Generation2s {
    function balanceOf(address owner) public view virtual returns (uint256) {}
}

contract ChibiGalaxies is ERC721, Pausable, Ownable {

    using Address for address;
    using MerkleProof for bytes32[];

    string public baseTokenURI;

    uint public preMintPrice = 0.06 ether;
    uint public preMintStartTime = 1636581600;  // Initializing 11/10/2021 05:00 PM EST
    uint public publicMintPrice = 0.08 ether;
    uint public publicMintStartTime = 1636668000; // Initializing 11/11/2021 5:00 PM EST
    uint public collectionSize = 7000;
    uint public maxItemsPerTx = 5;
    uint public currentGiveawayTokenId = 1;
    uint public maxGiveawayTokenId = 100;
    uint public currentRareTokenId = 101;
    uint public maxRareTokenId = 250;
    uint public currentOtherTokenId = 251;
    uint public totalSupply = 0;

    bool public onlyWhitelistedCanMint = true;

    bytes32 whitelistMerkleRoot;
    bytes32 gen1HoldersSnapshotMerkleRoot;

    mapping(address => uint) public ownerRareTokens;

    event Mint(address indexed owner, uint256 tokenId);

    Generation1s gen1ContractInstance;
    Generation2s gen2ContractInstance;

    constructor() ERC721("ChibiGalaxies", "CHIBIGALAXY") {}

    function giveawayMint(address to, uint amount) external onlyOwner {
        require((currentGiveawayTokenId + amount) <= maxGiveawayTokenId, "surpasses cap");
        _mintWithoutValidation(to, currentGiveawayTokenId, amount);
        currentGiveawayTokenId += amount;
    }

    function rareMintAmount() public view returns (uint) {
        uint numGen1sOwned = numGeneration1sOwned();
        uint numGen2sOwned = numGeneration2sOwned();
        return calculateRareMintAmount(numGen1sOwned, numGen2sOwned);
    }

    function rareMint(bytes32[] memory proof) external whenNotPaused {
        require(block.timestamp >= preMintStartTime, "not started");
        require(currentRareTokenId < maxRareTokenId, "surpass cap");
        require(isAddressInGen1Snapshot(proof, msg.sender), "invalid gen 1 holder");

        uint numGen1sOwned = numGeneration1sOwned();
        uint numGen2sOwned = numGeneration2sOwned();

        uint amount = calculateRareMintAmount(numGen1sOwned, numGen2sOwned);

        // don't allow additional minting if already minted their max
        require((amount > 0 && ownerRareTokens[msg.sender] < amount), "not eligible");

        if (((currentRareTokenId + amount) > maxRareTokenId) && (maxRareTokenId - currentRareTokenId) > 0){
            amount = maxRareTokenId - currentRareTokenId;
        }

        _mintWithoutValidation(msg.sender, currentRareTokenId, amount);
        ownerRareTokens[msg.sender] = ownerRareTokens[msg.sender] + amount;
        currentRareTokenId += amount;
    }

    function preMint(bytes32[] memory proof) external payable whenNotPaused {
        // make sure the current time is greater than or equal to the pre mint start time
        require(block.timestamp >= preMintStartTime && block.timestamp < publicMintStartTime, "not running");

        // verify that the client sent enough eth to pay for the mint
        uint remainder = msg.value % preMintPrice;
        require(remainder == 0, "send a divisible amount of eth");

        // calculate the amount of tokens we are minting based on the amount of eth sent
        uint amount = msg.value / preMintPrice;
        require(amount > 0, "amount to mint is 0");

        uint numGen1sOwned = numGeneration1sOwned();
        if (numGen1sOwned > 0){
            // address must be in gen 1 snapshot
            require(isAddressInGen1Snapshot(proof, msg.sender), "invalid gen 1 holder");
        }

        uint numGen2sOwned = numGeneration2sOwned();

        // only gen 1 or gen 2 owners can pre mint.
        require((numGen1sOwned > 0 || numGen2sOwned > 0), "not eligible");

        // calculate the max number of items to mint. (3 passes per gen 1, 1 pass per gen 2)
        uint maxItemsForPreMint = (numGen1sOwned * 3) + (numGen2sOwned * 1);

        uint numGeneration3sOwned = balanceOf(msg.sender);
        require((numGeneration3sOwned + amount) <= maxItemsForPreMint, "surpass pre mint cap");

        _mintWithoutValidation(msg.sender, currentOtherTokenId, amount);
        currentOtherTokenId += amount;
    }

    function publicMint(bytes32[] memory proof) external payable whenNotPaused {
        // make sure the current time is greater than or equal to the pre mint start time
        require(block.timestamp >= publicMintStartTime, "not started");

        // verify that the client sent enough eth to pay for the mint
        uint remainder = msg.value % publicMintPrice;
        require(remainder == 0, "send a divisible amount of eth");

        // calculate the amount of tokens we are minting based on the amount of eth sent
        uint amount = msg.value / publicMintPrice;

        require(amount <= maxItemsPerTx, "max 5 per tx");

        uint numGen1sOwned = numGeneration1sOwned();
        uint numGen2sOwned = numGeneration2sOwned();

        // perform the following only for wallets that don't have a gen 1 or gen 2
        if (onlyWhitelistedCanMint && numGen1sOwned == 0 && numGen2sOwned == 0){
            // should not throw if user is whitelisted, the amount being minted is equal to their whitelisted value and they
            // have not minted already.
            require(isAddressWhitelisted(proof, msg.sender), "not eligible to mint");
        }

        _mintWithoutValidation(msg.sender, currentOtherTokenId, amount);
        currentOtherTokenId += amount;
    }

    function _mintWithoutValidation(address to, uint startTokenId, uint amount) internal {
        require((totalSupply + amount) <= collectionSize, "sold out");
        for (uint i = 0; i < amount; i++) {
            totalSupply += 1;
            _mint(to, startTokenId + i);
            emit Mint(to, startTokenId + i);
        }
    }

    function calculateRareMintAmount(uint numGen1sOwned, uint numGen2sOwned) internal view returns (uint){
        if (numGen1sOwned > 0 && numGen2sOwned > 0){
            // the number of rares minted should be the lesser of gen 1s owned to gen 2s owned
            uint amount = numGen1sOwned;
            if (numGen1sOwned > numGen2sOwned) {
                amount = numGen2sOwned;
            }
            return amount - ownerRareTokens[msg.sender];
        }
        return 0;
    }

    function isAddressWhitelisted(bytes32[] memory proof, address _address) public view returns (bool) {
        return proof.verify(whitelistMerkleRoot, keccak256(abi.encodePacked(_address)));
    }

    function setWhitelistMerkleRoot(bytes32 _whitelistMerkleRoot) public onlyOwner {
        whitelistMerkleRoot = _whitelistMerkleRoot;
    }

    function isAddressInGen1Snapshot(bytes32[] memory proof, address _address) public view returns (bool) {
        return proof.verify(gen1HoldersSnapshotMerkleRoot, keccak256(abi.encodePacked(_address)));
    }

    function setGen1SnapshotMerkleRoot(bytes32 _gen1HoldersSnapshotMerkleRoot) public onlyOwner {
        gen1HoldersSnapshotMerkleRoot = _gen1HoldersSnapshotMerkleRoot;
    }

    function setGeneration1ContractAddress(address _gen1ContractAddress) public onlyOwner {
        require(_gen1ContractAddress.isContract(), "invalid contract address");
        gen1ContractInstance = Generation1s(_gen1ContractAddress);
    }

    function setGeneration2ContractAddress(address _gen2ContractAddress) public onlyOwner {
        require(_gen2ContractAddress.isContract(), "invalid contract address");
        gen2ContractInstance = Generation2s(_gen2ContractAddress);
    }

    function setMintInfo(uint _preMintPrice, uint _preMintStartTime, uint _publicMintPrice, uint _publicMintStartTime) public onlyOwner {
        preMintPrice = _preMintPrice;
        preMintStartTime = _preMintStartTime;
        publicMintPrice = _publicMintPrice;
        publicMintStartTime = _publicMintStartTime;
    }

    function setOnlyWhitelistedCanMint(bool _onlyWhitelistedCanMint) public onlyOwner {
        onlyWhitelistedCanMint = _onlyWhitelistedCanMint;
    }

    function setCollectionSize(uint _collectionSize) public onlyOwner {
        collectionSize = _collectionSize;
    }

    function setMaxItemsPerTrx(uint _maxItemsPerTrx) public onlyOwner {
        maxItemsPerTx = _maxItemsPerTrx;
    }

    function setBaseTokenURI(string memory _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function numGeneration1sOwned() public view returns (uint256) {
        return gen1ContractInstance.balanceOf(msg.sender);
    }

    function numGeneration2sOwned() public view returns (uint256) {
        return gen2ContractInstance.balanceOf(msg.sender);
    }

    // The following functions are overrides required by Solidity.
    function _burn(uint256 tokenId) internal override(ERC721) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721) returns (string memory) {
        return string(abi.encodePacked(baseTokenURI, Strings.toString(tokenId)));
    }
}