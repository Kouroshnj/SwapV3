const { ethers } = require("hardhat");
const { expect } = require("chai");
const erc20ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json").abi
const swapContractABI = require("../artifacts/contracts/SwapContract.sol/SwapContract.json").abi
const DaiAbi = require("../doc/ERC20ABI/ERC20ABI.json")


describe("Deploy wallet contract and swap assets", () => {

    const ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA"
    const AAVE = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"
    const BNB = "0xB8c77482e45F1F44dE1745F52C74426C631bDD52"
    const NEIRO = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    const FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
    let wallet;
    let walletAddress;
    let UsdcContract;
    let DAIcontract;
    let WethContract;
    let LinkContract;
    let BnbContract;
    let UsdtContract;
    let NeiroContract;


    const deploy = async () => {
        const [signer, addr1] = await ethers.getSigners();
        const Wallet = await ethers.getContractFactory("SwapContract");
        wallet = await Wallet.deploy(ROUTER, FACTORY, 200);
        walletAddress = wallet.getAddress();
        DAIcontract = new ethers.Contract(DAI, DaiAbi, signer)
        WethContract = new ethers.Contract(WETH, DaiAbi, signer);
        LinkContract = new ethers.Contract(LINK, DaiAbi, signer);
        // AaveContract = new ethers.Contract(AAVE, DaiAbi, signer)
        // BnbContract = new ethers.Contract(BNB, DaiAbi, signer)
        UsdtContract = new ethers.Contract(USDT, DaiAbi, signer)
        UsdcContract = new ethers.Contract(USDC, DaiAbi, signer)
        NeiroContract = new ethers.Contract(NEIRO, DaiAbi, signer)
    }

    before(deploy)

    const setVariables = async () => {
        const [signer, , addr2] = await ethers.getSigners();
        await wallet.connect(signer).setFeeForTokens(1, 100);
        await wallet.connect(signer).addStableCoinAddress(DAI);
        await wallet.connect(signer).addStableCoinAddress(USDT);
    }

    before(setVariables);

    it("should add a new recipient", async () => {
        const [signer, , addr2] = await ethers.getSigners();
        await wallet.connect(signer).addRecipient(addr2.address, 200);
    })

    it("should revert because duplicate recipient", async () => {
        const [signer, , addr2] = await ethers.getSigners();
        const invalidRecipient = wallet.connect(signer).addRecipient(addr2.address, 200);
        await expect(invalidRecipient).to.be.rejectedWith('Duplicate recipient!');
    })

    it("should revert beacuse reaching maximum percentage allocation", async () => {
        const [signer, , addr2, addr3] = await ethers.getSigners();
        const invalidRecipient = wallet.connect(signer).addRecipient(addr3.address, 9601);
        await expect(invalidRecipient).to.be.revertedWith("Reached maximum!")
    })

    it("should change the fee percentage of a recipient", async () => {
        const [signer, , addr2, addr3] = await ethers.getSigners();
        console.log("total fee before changing: ", await wallet.getTotalAttachedFees())
        console.log(await wallet.getRecipientByAddress(addr2.address))
        await wallet.connect(signer).changeRecipientFee(addr2.address, 400);
        console.log(await wallet.getRecipientByAddress(addr2.address))
        console.log("total fee after changing: ", await wallet.getTotalAttachedFees())
    })

    it("should return all of the recipients", async () => {
        const data = await wallet.getAllRecipients();
        console.log(data);
    })

    it("should call 'swapETHToTokenV3' function", async () => {
        const [signer, addr1, addr2, addr3] = await ethers.getSigners();


        await UsdtContract.connect(addr1).approve(walletAddress, 5000000000000000000n)

        const tx = await wallet.connect(addr1).swapETHToTokenV3(USDT, 0, 3000, 0, { value: ethers.parseEther("2") })
        await wallet.connect(addr1).swapETHToTokenV3(DAI, 0, 3000, 0, { value: ethers.parseEther("1") });
        console.log("USDT balance of user: ", await UsdtContract.balanceOf(addr1.address));
        console.log("wallet USDT balance of contract: ", await UsdtContract.balanceOf(walletAddress));
        console.log("signer USDT balance: ", await UsdtContract.balanceOf(signer.address));
        console.log("addr2 USDT balance: ", await UsdtContract.balanceOf(addr2.address))

        // console.log("addr1 LINK balance: ", await LinkContract.balanceOf(addr1.address));
        // console.log(await ethers.provider.getBalance(addr1.address));
        // console.log("wallet DAI balance: ", await DAIcontract.balanceOf(walletAddress));
        // console.log("wallet LINK balance: ", await LinkContract.balanceOf(walletAddress));
        await expect(tx).to.emit(wallet, "SwapEthToToken")
    })


    it("should call funciton 'swapTokenToETHV3'", async () => {
        const [signer, addr1, addr2, addr3] = await ethers.getSigners();

        // await UsdtContract.connect(addr1).approve(walletAddress, 4000000000n)
        // await DAIcontract.connect(addr1).transferFrom(addr1.address, walletAddress, 11000000000000000000000n)
        console.log("wallet balance before third swap: ", await UsdtContract.balanceOf(walletAddress));
        console.log("signer balance before third swap: ", await UsdtContract.balanceOf(signer.address));
        console.log("user balance after third swap: ", await UsdtContract.balanceOf(addr1.address));
        await wallet.connect(addr1).swapTokenToETHV3(USDT, 4000000000n, 0, 3000, 0)
        console.log("user balance after swap:", await UsdtContract.balanceOf(addr1.address));
        console.log("signer balance after third swap: ", await UsdtContract.balanceOf(signer.address));
        console.log("wallet balance after third swap: ", await UsdtContract.balanceOf(walletAddress));

        console.log("this is WETH balance: ", await WethContract.balanceOf(addr1.address));

    })

    it.skip("owner of contract should withdraw remaining tokens from contract", async () => {
        const [signer] = await ethers.getSigners();
        console.log("LINK balance of contract before withdraw: ", await LinkContract.balanceOf(walletAddress));
        console.log("LINK balance of signer before withdraw: ", await LinkContract.balanceOf(signer.address));
        await wallet.connect(signer).withdrawTokenFromContract(LINK);
        console.log("LINK balance of contract after withdraw: ", await LinkContract.balanceOf(walletAddress));
        console.log("LINK balance of signer after withdraw: ", await LinkContract.balanceOf(signer.address));
    })

    it.skip("should call function 'swapTokenToTokenV3' when swaping USDT for USDC ", async () => {
        const [signer, addr1, addr2, addr3] = await ethers.getSigners();

        console.log("this is NEIRO balance of contract before swap: ", await UsdcContract.balanceOf(walletAddress));
        console.log("this is NEIRO balance of user before swap: ", await UsdcContract.balanceOf(addr1.address));
        console.log("this is USDT balance of addr1 before swap: ", await UsdtContract.balanceOf(addr1.address));
        console.log("this is USDT balance of addr1 before swap: ", await UsdtContract.balanceOf(walletAddress));
        await wallet.connect(addr1).swapTokenToTokenV3(USDT, DAI, 20000n, 0, 3000, 0);
        console.log("this is USDT balance of user after swap: ", await UsdtContract.balanceOf(addr1.address));
        console.log("this is USDT balance of addr1 before swap: ", await UsdtContract.balanceOf(walletAddress));
        console.log("this is NEIRO balance of user after swap: ", await UsdcContract.balanceOf(addr1.address));
        console.log("this is NEIRO balance of contract before swap: ", await UsdcContract.balanceOf(walletAddress));

    })

    it.skip("should call function 'swapTokenToTokenV3' when swaping DAI for WETH ", async () => {
        const [signer, addr1, addr2, addr3] = await ethers.getSigners();

        await DAIcontract.connect(addr1).approve(walletAddress, 1000000000000000000000n)
        console.log("this is DAI balance of signer before swap: ", await DAIcontract.balanceOf(signer.address));
        console.log("this is DAI balance of addr2 before swap: ", await DAIcontract.balanceOf(addr2.address));
        console.log("this is DAI balance of addr1 before swap: ", await DAIcontract.balanceOf(addr1.address));
        await wallet.connect(addr1).swapTokenToTokenV3(DAI, WETH, 1000000000000000000000n, 0, 3000, 0);
        console.log("addr1 WETH balance: ", await WethContract.balanceOf(addr1));
        console.log("this is DAI balance of signer after  swap: ", await DAIcontract.balanceOf(signer.address));
        console.log("this is DAI balance of addr2 after swap: ", await DAIcontract.balanceOf(addr2.address));
        console.log("this is DAI balance of addr1 after swap: ", await DAIcontract.balanceOf(addr1.address));
        console.log("this is DAI balance of contract after swap: ", await DAIcontract.balanceOf(walletAddress));

        console.log("this is DAI balance of contract: ", await DAIcontract.balanceOf(walletAddress));
    })

    it("should call function 'swapTokenToTokenV3' when swaping DAI for USDC ", async () => {
        const [signer, addr1, addr2, addr3] = await ethers.getSigners();

        await DAIcontract.connect(addr1).approve(walletAddress, 100000000000000000000n)
        console.log("this is USDC balance of signer before swap: ", await UsdcContract.balanceOf(signer.address));
        console.log("this is USDC balance of addr2 before swap: ", await UsdcContract.balanceOf(addr2.address));
        console.log("this is USDC balance of addr1 before swap: ", await UsdcContract.balanceOf(addr1.address));
        await wallet.connect(addr1).swapTokenToTokenV3(DAI, USDC, 100000000000000000000n, 0, 3000, 0);
        console.log("this is USDC balance of signer after  swap: ", await UsdcContract.balanceOf(signer.address));
        console.log("this is USDC balance of addr2 after swap: ", await UsdcContract.balanceOf(addr2.address));
        console.log("this is USDC balance of addr1 after swap: ", await UsdcContract.balanceOf(addr1.address));
        console.log("this is USDC balance of contract after swap: ", await UsdcContract.balanceOf(walletAddress));

        console.log("this is DAI balance of contract: ", await DAIcontract.balanceOf(walletAddress));
    })

    it.skip("should call function 'swapTokenToTokenV3' when swaping AAVE for LINK ", async () => {
        const [signer, addr1, addr2, addr3] = await ethers.getSigners();

        await AaveContract.connect(addr1).approve(walletAddress, 4000000000000000000n)
        console.log("this is AAVE balance of addr1 before swap: ", await AaveContract.balanceOf(addr1.address));
        console.log("contract AAVE balance: ", await AaveContract.balanceOf(walletAddress))
        console.log("LINK balance of addr1", await LinkContract.balanceOf(addr1.address));
        const amountOutMin = await wallet.callEstimateAmountOut(AAVE, LINK, 4000000000000000000n, 3000, 10);
        const tx = await wallet.connect(addr1).swapTokenToTokenV3(AAVE, LINK, 4000000000000000000n, 0, 3000, 0);
        console.log("this is AAVE balance of addr1 after swap: ", await AaveContract.balanceOf(addr1.address));
        console.log("this is AAVE balance of contract after swap: ", await AaveContract.balanceOf(walletAddress));
        console.log("LINK balance of addr1", await LinkContract.balanceOf(addr1.address));
    })

    it("change fee recipient fee", async () => {
        const [signer, addr1, addr2, addr3] = await ethers.getSigners();
        await wallet.connect(signer).changeRecipientFee(signer.address, 9400);
    })

    it("should get value of amountOutMin from oracle and then set it to swapTokenToTokenV3 function", async () => {
        const [signer, addr1, addr2, addr3] = await ethers.getSigners();
        const amountOutMin = await wallet.callEstimateAmountOut(DAI, USDC, 1000000000000000000000n, 3000, 10);
        console.log(amountOutMin);
        await DAIcontract.connect(addr1).approve(walletAddress, 1000000000000000000000n)
        await wallet.connect(addr1).swapTokenToTokenV3(DAI, USDC, 1000000000000000000000n, 0, 3000, 0);
        console.log(await NeiroContract.balanceOf(addr1.address));
    })

    it("should revert because only owner function", async () => {
        const [signer, addr1] = await ethers.getSigners();

        const invalidOwner = wallet.connect(addr1).addRecipient(addr1.address, 500);
        await expect(invalidOwner).to.be.revertedWith('Not owner!')
    })

    it("should withdraw a specific token that has remained in the contract", async () => {
        const [signer] = await ethers.getSigners();
        console.log("contract before", await UsdtContract.balanceOf(walletAddress));
        console.log("recipient before", await UsdtContract.balanceOf(signer.address));
        await wallet.connect(signer).withdrawTokenFromContract(USDT);
        console.log("contract after", await UsdtContract.balanceOf(walletAddress));
        console.log("recipient after", await UsdtContract.balanceOf(signer.address));
    })



})