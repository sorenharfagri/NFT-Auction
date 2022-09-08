// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./Token/IERC721Receiver.sol";
import "./Token/IERC721.sol";
import "./Utils/Ownable.sol";

contract Auction is Ownable, IERC721Receiver {

    uint256 public lotCreationFee;
    uint256 public auctionMinimumDuration = 3600;
    uint256 public auctionMaximumDuration = 86400;

    mapping(address => mapping(uint256 => Lot)) public lots;

    event NewLot(address indexed tokenAddress, uint256 indexed nftId, Lot lot);

    event NewBet(address indexed tokenAddress, uint256 indexed nftId, Lot lot);

    event LotClosed(
        address indexed tokenAddress,
        uint256 indexed nftId,
        Lot lot
    );

    struct Lot {
        uint256 currentBet;
        uint256 endTimestamp;
        address owner;
        address currentBettor;
    }

    function setLotCreationFee(uint256 fee) public onlyOwner {
        lotCreationFee = fee;
    }

    function createLot(
        address tokenContract,
        uint256 tokenId,
        uint256 duration
    ) public payable {
        require(
            (_isAllTokenApproved(tokenContract, msg.sender) ||
                _isTokenApproved(tokenContract, tokenId)),
            "Token not approved"
        );

        require(
            msg.value >= lotCreationFee,
            "Msg value not enough to pay creation fee"
        );

        require(
            duration >= auctionMinimumDuration ||
                duration <= auctionMaximumDuration,
            "Invalid duration"
        );

        IERC721(tokenContract).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        lots[tokenContract][tokenId] = Lot(
            0,
            block.timestamp + duration,
            msg.sender,
            address(0)
        );

        emit NewLot(tokenContract, tokenId, lots[tokenContract][tokenId]);
    }

    function bet(address tokenContract, uint256 tokenId) public payable {
        require(_lotExists(tokenContract, tokenId), "Lot doesnt exists");

        Lot memory lot = lots[tokenContract][tokenId];

        require(_lotStillOngoing(lot), "The lot is over");

        require(msg.value > lot.currentBet, "Bet amount not enough");

        require(msg.sender != lot.owner, "You cant bet on your own lot");

        // possible reetrancy attack

        address payable lastBettor = payable(lot.currentBettor);

        lots[tokenContract][tokenId].currentBettor = msg.sender;
        lots[tokenContract][tokenId].currentBet = msg.value;

        lastBettor.transfer(lot.currentBet);

        emit NewBet(tokenContract, tokenId, lots[tokenContract][tokenId]);
    }

    function closeLot(address tokenContract, uint256 tokenId) public {
        require(_lotExists(tokenContract, tokenId), "Lot doesnt exists");

        Lot memory lot = lots[tokenContract][tokenId];

        require(!_lotStillOngoing(lot), "Lot not finished yet");

        delete lots[tokenContract][tokenId];

        if (lot.currentBet > 0) {
            address payable lotOwnerAddress = payable(lot.owner);

            // tranfser eth back to seller
            // and nft to auction winner

            lotOwnerAddress.transfer(lot.currentBet);

            IERC721(tokenContract).safeTransferFrom(
                address(this),
                lot.currentBettor,
                tokenId
            );
        } else {
            // transfer nft back to owner If there was no bets
            IERC721(tokenContract).safeTransferFrom(
                address(this),
                lot.owner,
                tokenId
            );
        }

        emit LotClosed(tokenContract, tokenId, lot);
    }

    function getLot(address tokenContract, uint256 tokenId)
        public
        view
        returns (Lot memory)
    {
        require(_lotExists(tokenContract, tokenId), "Lot doesnt exists");
        return lots[tokenContract][tokenId];
    }

    function setMinimumAcutionDUration(uint256 _secunds) public onlyOwner {
        auctionMinimumDuration = _secunds;
    }

    function setMaximumAuctionDuration(uint256 _secunds) public onlyOwner {
        auctionMaximumDuration = _secunds;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _lotExists(address tokenContract, uint256 tokenId)
        internal
        view
        returns (bool)
    {
        return lots[tokenContract][tokenId].endTimestamp != 0;
    }

    // block 1100
    // endTime 1500
    
    // block 1600
    // endTime 1700

    // endtime 1600
    // block 1900

    function _lotStillOngoing(Lot memory lot) internal view returns (bool) {
        return block.timestamp <= lot.endTimestamp;
    }

    function _isTokenApproved(address erc721address, uint256 tokenId)
        private
        view
        returns (bool)
    {
        IERC721 nftContract = IERC721(erc721address);
        try nftContract.getApproved(tokenId) returns (address tokenOperator) {
            return tokenOperator == address(this);
        } catch {
            return false;
        }
    }

    function _isAllTokenApproved(address erc721address, address owner)
        private
        view
        returns (bool)
    {
        return IERC721(erc721address).isApprovedForAll(owner, address(this));
    }
}
