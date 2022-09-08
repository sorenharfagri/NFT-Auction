import { ethers } from "hardhat";
import { expect } from "chai"

import { Auction, NftToken } from "../typechain-types";

const zeroAddress = "0x0000000000000000000000000000000000000000"

describe("Auction", () => {

    let adminAcc: any
    let acc2: any
    let acc3: any

    let auction: Auction
    let token: NftToken

    const tokenName = "NEKACOIN"
    const tokenSymbol = "NEKA"

    const nftTokenId_1 = 1

    beforeEach(async () => {

        [adminAcc, acc2, acc3] = await ethers.getSigners()

        const auctionFactory = await ethers.getContractFactory("Auction", adminAcc)
        const nftTokenFactory = await ethers.getContractFactory("NftToken", adminAcc)

        auction = await auctionFactory.deploy() // tx send

        token = await nftTokenFactory.deploy(tokenName, tokenSymbol) // tx send

        // wait for confirmation
        await auction.deployed()
        await token.deployed()

        await token.connect(adminAcc).safeMint(adminAcc.address)
        await token.connect(adminAcc).safeMint(adminAcc.address)
    })


    it("Auction and nft be deployed", () => {
        expect(auction.address).to.be.properAddress
        expect(token.address).to.be.properAddress
    })

    it("Only owner should be able to set lot creation comission", async () => {

        let lotCreationComissionFee = 100

        const tx = await auction.connect(adminAcc).setLotCreationFee(lotCreationComissionFee)
        await tx.wait()

        const comission = await auction.lotCreationFee()

        expect(comission).equal(lotCreationComissionFee)

        const setComissionFakeTx = auction.connect(acc2).setLotCreationFee(lotCreationComissionFee)

        await expect(setComissionFakeTx).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("User should be able to create lot", async () => {

        const lotCreatorAcc = acc2
        const nftIdToSell = nftTokenId_1
        const lotCreationComissionFee = 100

        const setFeeTx = await auction.connect(adminAcc).setLotCreationFee(lotCreationComissionFee)
        await setFeeTx.wait()

        await transferNftTo(nftIdToSell, lotCreatorAcc.address)
        await approveAllTokensToAuction(lotCreatorAcc)

        const duration = await auction.auctionMinimumDuration()

        const createLotTx = await auction.connect(lotCreatorAcc).createLot(token.address, nftIdToSell, duration, { value: lotCreationComissionFee })
        await createLotTx.wait()

        const lot = await auction.getLot(token.address, nftIdToSell)

        await expect(createLotTx).to.emit(auction, "NewLot").withArgs(token.address, nftIdToSell, lot)

        //@ts-ignore
        const txBlock = await ethers.provider.getBlock(createLotTx.blockNumber)

        const txTimeStamp = txBlock.timestamp

        const auctionEndTimestamp = duration.add(txTimeStamp)

        expect(lot.owner).equal(lotCreatorAcc.address)
        expect(lot.currentBet).equal(0)
        expect(lot.endTimestamp).equal(auctionEndTimestamp)
        expect(lot.currentBettor).equal(zeroAddress)
    })

    it("User can create lot with setApprovalForAll approve", async () => {
        const sellerAcc = acc2
        const tokenToSellId = nftTokenId_1
        const duration = await auction.auctionMinimumDuration()

        await transferNftTo(tokenToSellId, sellerAcc.address)
        await approveAllTokensToAuction(sellerAcc)

        const txValue = await auction.lotCreationFee()

        const listNftTx = await auction.connect(sellerAcc).createLot(token.address, tokenToSellId, duration, { value: txValue })
        await listNftTx.wait()
    })

    it("User can create lot with signle token approve", async () => {

        const sellerAcc = acc2
        const tokenToSellId = nftTokenId_1
        const duration = await auction.auctionMinimumDuration()

        await transferNftTo(tokenToSellId, sellerAcc.address)
        await approveTokenToAuction(sellerAcc, tokenToSellId)

        const txValue = await auction.lotCreationFee()

        const listNftTx = await auction.connect(sellerAcc).createLot(token.address, tokenToSellId, duration, { value: txValue })
        await listNftTx.wait()
    })

    it("Contract should receive commission on lot creation", async () => {

        const lotCreatorAcc = acc2
        const nftIdToSell = nftTokenId_1
        const lotCreationComissionFee = 100

        const setFeeTx = await auction.connect(adminAcc).setLotCreationFee(lotCreationComissionFee)
        await setFeeTx.wait()

        await transferNftTo(nftIdToSell, lotCreatorAcc.address)
        await approveAllTokensToAuction(lotCreatorAcc)

        const duration = await auction.auctionMinimumDuration()

        const createLotTx = await auction.connect(lotCreatorAcc).createLot(token.address, nftIdToSell, duration, { value: lotCreationComissionFee })

        await createLotTx.wait()

        await expect(createLotTx).to.changeEtherBalances([auction, lotCreatorAcc], [+lotCreationComissionFee, -lotCreationComissionFee])
    })

    it("Contract receives user nft after lot creation", async () => {
        const bettorAcc = acc2
        const nftIdToSell = nftTokenId_1

        const lotCreationComissionFee = 100

        const setFeeTx = await auction.connect(adminAcc).setLotCreationFee(lotCreationComissionFee)
        await setFeeTx.wait()

        await transferNftTo(nftIdToSell, bettorAcc.address)
        await approveAllTokensToAuction(bettorAcc)

        const duration = await auction.auctionMinimumDuration()

        const createLotTx = await auction.connect(bettorAcc).createLot(token.address, nftIdToSell, duration, { value: lotCreationComissionFee })

        await createLotTx.wait()

        const transferedNftOwner = await token.ownerOf(nftIdToSell)

        expect(transferedNftOwner).equal(auction.address)
    })

    it("Creation of lot fails if tx value not enough to pay comission", async () => {

        const bettorAcc = acc2
        const nftIdToSell = nftTokenId_1
        const lotCreationComissionFee = 100

        const setFeeTx = await auction.connect(adminAcc).setLotCreationFee(lotCreationComissionFee)
        await setFeeTx.wait()

        await transferNftTo(nftIdToSell, bettorAcc.address)
        await approveAllTokensToAuction(bettorAcc)

        const duration = await auction.auctionMinimumDuration()

        const createLotTx = auction.connect(bettorAcc).createLot(token.address, nftIdToSell, duration, { value: lotCreationComissionFee - 1 })

        await expect(createLotTx).to.be.revertedWith("Msg value not enough to pay creation fee")
    })

    it("Creation of lot fails if nft not approved for auction contract", async () => {

        const bettorAcc = acc2
        const nftIdToSell = nftTokenId_1
        const lotCreationComissionFee = 100

        const setFeeTx = await auction.connect(adminAcc).setLotCreationFee(lotCreationComissionFee)
        await setFeeTx.wait()

        await transferNftTo(nftIdToSell, bettorAcc.address)

        const duration = await auction.auctionMinimumDuration()

        const createLotTx = auction.connect(bettorAcc).createLot(token.address, nftIdToSell, duration, { value: lotCreationComissionFee })

        await expect(createLotTx).to.be.revertedWith("Token not approved")

    })

    it("User should be able to bet", async () => {

        const lotCreatorAcc = acc2
        const bettorAcc = acc3
        const nftIdToSell = nftTokenId_1
        const betAmount = 1000

        await createDefaultLot(lotCreatorAcc, nftIdToSell)

        const betTx = await auction.connect(bettorAcc).bet(token.address, nftIdToSell, { value: betAmount })
        await betTx.wait()

        const lot = await auction.lots(token.address, nftIdToSell)

        expect(lot.currentBet).equal(betAmount)
        expect(lot.currentBettor).equal(bettorAcc.address)

        await expect(betTx).to.emit(auction, "NewBet").withArgs(token.address, nftIdToSell, lot)
    })

    it("User cannot place a bid on his own lot", async () => {

        const lotCreatorAcc = acc2
        const nftIdTOSell = nftTokenId_1

        await createDefaultLot(lotCreatorAcc, nftIdTOSell)

        const betAmount = 1000

        const betTx = auction.connect(lotCreatorAcc).bet(token.address, nftIdTOSell, { value: betAmount })

        await expect(betTx).to.be.revertedWith("You cant bet on your own lot")

    })

    it("The bet can be outbid by a bigger bet", async () => {

        const lotCreatorAcc = adminAcc
        const bettorAcc1 = acc2
        const bettorAcc2 = acc3
        const nftIdToSell = nftTokenId_1

        await createDefaultLot(lotCreatorAcc, nftIdToSell)

        const betAmount = 1000
        const biggerBetAmount = 2000

        const betTx = await auction.connect(bettorAcc1).bet(token.address, nftIdToSell, { value: betAmount })
        await betTx.wait()

        const bet2Tx = await auction.connect(bettorAcc2).bet(token.address, nftIdToSell, { value: biggerBetAmount })
        await bet2Tx.wait()

        const lot = await auction.lots(token.address, nftIdToSell)

        expect(lot.currentBet).equal(biggerBetAmount)
        expect(lot.currentBettor).equal(bettorAcc2.address)
    })

    it("Money returns to prev bettor when he outbided", async () => {

        const lotCreatorAcc = adminAcc
        const bettorAcc1 = acc2
        const bettorAcc2 = acc3
        const nftIdToSell = nftTokenId_1

        await createDefaultLot(lotCreatorAcc, nftTokenId_1)

        const betAmount = 1000
        const biggerBetAmount = 2000

        const betTx = await auction.connect(bettorAcc1).bet(token.address, nftIdToSell, { value: betAmount })
        await betTx.wait()

        await expect(betTx).to.changeEtherBalances([auction, bettorAcc1], [+betAmount, -betAmount])

        const bet2Tx = await auction.connect(bettorAcc2).bet(token.address, nftIdToSell, { value: biggerBetAmount })
        await bet2Tx.wait()

        await expect(bet2Tx).to.changeEtherBalances([auction, bettorAcc1], [-betAmount + biggerBetAmount, +betAmount])
    })

    it("Any can close auction, winner gets the nft, seller gets eth", async () => {

        const lotCreator = acc2
        const buyer = acc3
        const nftIdToSell = nftTokenId_1
        const betAmount = 1000

        const {
            duration,
            payedFee
        } = await createDefaultLot(lotCreator, nftTokenId_1)

        const betTx = await auction.connect(buyer).bet(token.address, nftIdToSell, { value: betAmount })
        await betTx.wait()

        const durSumm = duration.toNumber() + 10000
        await ethers.provider.send('evm_increaseTime', [durSumm]);

        const lotBeforeClosing = await auction.getLot(token.address, nftIdToSell)

        const closeLotTx = await auction.connect(buyer).closeLot(token.address, nftIdToSell)
        await closeLotTx.wait()

        await expect(closeLotTx).to.changeEtherBalances([auction, lotCreator], [-betAmount, +betAmount])

        await expect(closeLotTx).to.emit(auction, "LotClosed").withArgs(token.address, nftIdToSell, lotBeforeClosing)

        const lotAfterClosing = auction.getLot(token.address, nftIdToSell)

        await expect(lotAfterClosing).to.be.revertedWith("Lot doesnt exists")

        const newNftOwner = await token.ownerOf(nftIdToSell)

        expect(newNftOwner).equal(buyer.address)

    })

    it("If there was no bets on auction close, owner gets his nft back", async () => {

        const lotCreator = acc3
        const nftIdToSell = nftTokenId_1

        const {
            duration,
            payedFee
        } = await createDefaultLot(lotCreator, nftTokenId_1)

        const lotBeforeClosing = await auction.getLot(token.address, nftIdToSell)

        const durSumm = duration.toNumber() + 10000
        await ethers.provider.send('evm_increaseTime', [durSumm]);

        const closeLotTx = await auction.connect(lotCreator).closeLot(token.address, nftIdToSell)
        await closeLotTx.wait()

        await expect(closeLotTx).to.emit(auction, "LotClosed").withArgs(token.address, nftIdToSell, lotBeforeClosing)

        await expect(closeLotTx).to.changeEtherBalances([auction, lotCreator], [0, 0])

        const lotAfterClosing = auction.getLot(token.address, nftIdToSell)

        await expect(lotAfterClosing).to.be.revertedWith("Lot doesnt exists")

        const newNftOwner = await token.ownerOf(nftIdToSell)
        expect(newNftOwner).equal(lotCreator.address)

    })

    it("User cannot close lot which is still going on", async () => {

        const lotCreator = acc3
        const nftIdToSell = nftTokenId_1

        await createDefaultLot(lotCreator, nftIdToSell)

        const closeLotTx = auction.connect(lotCreator).closeLot(token.address, nftIdToSell)

        await expect(closeLotTx).to.be.revertedWith("Lot not finished yet")
    })

    it("User cannot close lot which is still going on", async () => {

        const lotCreator = acc3
        const nftIdToSell = nftTokenId_1


        await createDefaultLot(lotCreator, nftIdToSell)

        const closeLotTx = auction.connect(lotCreator).closeLot(token.address, nftIdToSell)

        await expect(closeLotTx).to.be.revertedWith("Lot not finished yet")
    })

    it("User cannot close a lot twice", async () => {

        const lotCreator = acc3
        const nftIdToSell = nftTokenId_1

        const {
            duration,
            payedFee
        } = await createDefaultLot(lotCreator, nftIdToSell)
        const durSumm = duration.toNumber() + 10000

        await ethers.provider.send('evm_increaseTime', [durSumm]);

        const closeLotTx = await auction.connect(lotCreator).closeLot(token.address, nftIdToSell)

        await closeLotTx.wait()

        const closeLotSecondTx = auction.connect(lotCreator).closeLot(token.address, nftIdToSell)

        await expect(closeLotSecondTx).to.be.revertedWith("Lot doesnt exists")
    })

    it("User cannot close lot that doesnt exists", async () => {
        const closeLotTx = auction.connect(acc2).closeLot(token.address, nftTokenId_1)

        await expect(closeLotTx).to.be.revertedWith("Lot doesnt exists")
    })


    async function createDefaultLot(creator: any, nftId: number) {

        const duration = await auction.auctionMinimumDuration()

        await transferNftTo(nftId, creator.address)
        await approveAllTokensToAuction(creator)

        const txValue = await auction.lotCreationFee()

        const createLotTx = await auction.connect(creator).createLot(token.address, nftId, duration, { value: txValue })

        await createLotTx.wait()

        return {
            duration,
            payedFee: txValue
        }
    }

    async function transferNftTo(nftId: number, to: string) {
        const transferTx = await token.connect(adminAcc)["safeTransferFrom(address,address,uint256)"](adminAcc.address, to, nftId)
        return await transferTx.wait()
    }


    async function approveAllTokensToAuction(ownerAcc: any) {
        const approveTx = await token.connect(ownerAcc).setApprovalForAll(auction.address, true)
        return await approveTx.wait()
    }

    async function approveTokenToAuction(ownerAcc: any, tokenId: number) {
        const approveTx = await token.connect(ownerAcc).approve(auction.address, tokenId)
        return await approveTx.wait()
    }

})