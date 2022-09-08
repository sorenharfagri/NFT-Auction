//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC721Metadata.sol";
import "./IERC721Receiver.sol";
import "./IERC721.sol";
import "./ERC165.sol";
import "../Utils/Strings.sol";

contract ERC721 is ERC165, IERC721Metadata {
    using Strings for uint256;

    string public _name;
    string public _symbol;
    string _baseURI =
        "https://ipfs.io/ipfs/Qmec1vWYzw2J7ZvdPxCBtAFocCeSG85njpU1bGn3TradVA/";

    mapping(address => uint256) _balances;
    mapping(uint256 => address) _owners;
    mapping(uint256 => address) _tokenApprovals;
    mapping(address => mapping(address => bool)) _operatorApprovals;

    modifier _requireMinted(uint256 tokenId) {
        require(_exists(tokenId), "Query for nonexistent token");
        _;
    }

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        _requireMinted(tokenId)
        returns (string memory)
    {
        string memory baseURI = _getBaseURI();

        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString()))
                : "";
    }

    function _setBaseURI(string memory baseURI) internal virtual {
        _baseURI = baseURI;
    }

    function _getBaseURI() internal view virtual returns (string memory) {
        return _baseURI;
    }

    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "owner cannot be zero");

        return _balances[owner];
    }

    function approve(address to, uint256 tokenId) public {
        address _owner = ownerOf(tokenId);

        require(
            _owner == msg.sender || isApprovedForAll(_owner, msg.sender),
            "Not an owner"
        );

        require(to != _owner, "Cannot approve to self");

        _tokenApprovals[tokenId] = to;

        emit Approval(_owner, to, tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "Not approved or owner!"
        );

        _transfer(from, to, tokenId);
    }

    function _safeTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal {
        _transfer(from, to, tokenId);

        require(
            _checkOnERC721Received(from, to, tokenId, data),
            "transfer to non-erc721 receiver"
        );
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private returns (bool) {
        if (to.code.length > 0) {
            try
                IERC721Receiver(to).onERC721Received(
                    msg.sender,
                    from,
                    tokenId,
                    data
                )
            returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("Transfer to non-erc721 receiver");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    function _safeMint(
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal virtual {
        _mint(to, tokenId);

        require(
            _checkOnERC721Received(address(0), to, tokenId, data),
            "non-erc721 receiver"
        );
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "to cannot be null address");

        require(!_exists(tokenId), "already exists");

        _owners[tokenId] = to;
        _balances[to]++;
    }

    function burn(uint256 tokenId) public virtual {
        require(_isApprovedOrOwner(msg.sender, tokenId), "not owner!");

        _burn(tokenId);
    }

    function _burn(uint256 tokenId) internal virtual {
        address owner = ownerOf(tokenId);

        _beforeTokenTransfer(owner, address(0), tokenId);

        delete _tokenApprovals[tokenId];
        _balances[owner]--;
        delete _owners[tokenId];

        emit Transfer(owner, address(0), tokenId);

        _afterTokenTransfer(owner, address(0), tokenId);
    }

    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal {
        require(ownerOf(tokenId) == from, "not an owner!");
        require(to != address(0), "to cannot be zero!");

        _beforeTokenTransfer(from, to, tokenId);

        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);

        _afterTokenTransfer(from, to, tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {}

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata data
    ) public virtual override {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "not an owner or approved"
        );

        _safeTransfer(from, to, tokenId, data);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override {
        require(
            _isApprovedOrOwner(msg.sender, tokenId),
            "not an owner or approved"
        );

        _safeTransfer(from, to, tokenId, "");
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
        view
        returns (bool)
    {
        address owner = ownerOf(tokenId);

        return (spender == owner ||
            isApprovedForAll(owner, spender) ||
            getApproved(tokenId) == spender);
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function ownerOf(uint256 tokenId)
        public
        view
        _requireMinted(tokenId)
        returns (address)
    {
        return _owners[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        require(msg.sender != operator, "cannot approve to self");

        _operatorApprovals[msg.sender][operator] = approved;

        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function getApproved(uint256 tokenId)
        public
        view
        _requireMinted(tokenId)
        returns (address)
    {
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address owner, address operator)
        public
        view
        returns (bool)
    {
        return _operatorApprovals[owner][operator];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        pure
        virtual
        override
        returns (bool)
    {
        return
            interfaceId == type(IERC721).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
