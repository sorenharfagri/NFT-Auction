//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC721.sol";
import "./ERC721Enumerable.sol";
import "../Utils/Ownable.sol";

contract NftToken is ERC721, ERC721Enumerable, Ownable {

    uint256 currentTokenId;

    constructor(string memory _tokenName, string memory _tokenSymbol)
        ERC721(_tokenName, _tokenSymbol)
    {}

    function safeMint(address to) public onlyOwner {

        _safeMint(to, currentTokenId);

        currentTokenId++;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        pure
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string memory newBaseUri) public onlyOwner {
        _baseURI = newBaseUri;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
}
