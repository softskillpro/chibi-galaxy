// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Chibis is ERC721, ERC721URIStorage, Ownable {

    uint public _maxItems = 200;
    uint public _currentMintCount = 0;
    uint public _totalSupply = 0;

    string public _baseTokenURI;

    event Mint(address indexed owner, uint indexed tokenId);

    constructor() ERC721("Chibi", "CHIBI") {}

    function mint() public onlyOwner {
        require(_totalSupply + 1 <= _maxItems, "mint: Surpasses cap");
        _currentMintCount += 1;
        _totalSupply += 1;
        address to = msg.sender;
        _mint(to, _totalSupply);
        emit Mint(to, _totalSupply);
    }

    function setBaseURI(string memory __baseTokenURI) public onlyOwner {
        _baseTokenURI = __baseTokenURI;
    }

    function baseURI() public view returns (string memory) {
        return _baseURI();
    }
    
    function currentMintCount() public view onlyOwner returns(uint256){
        return _currentMintCount;
    }

    function setTokenURI(uint256 _tokenId, string memory _tokenURI) public onlyOwner {
        _setTokenURI(_tokenId, _tokenURI);
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 _tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(_tokenId);
    }

    function tokenURI(uint256 _tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(_tokenId);
    }

    function _baseURI() internal view virtual override(ERC721) returns (string memory) {
        return _baseTokenURI;
    }
}
