// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./interfaces/ISwapRouter.sol";
import "./utils/UniswapV3Oracle.sol";

contract SwapContract is UniswapV3Twap {
    address public owner;
    address public router;
    uint64 public stableCoinCounter = 0;
    uint64 public recipientsCounter = 1;
    uint16 private totalAttachedFees; //10000 is the maximum value
    uint256 private feeInUSD = 500000;
    uint8 numerator;
    uint24 denominator;

    event SwapEthToToken(
        address sender,
        address tokenOut,
        uint256 ethAmountEntered,
        uint256 amountOut
    );
    event SwapTokenToEth(
        address sender,
        address tokenIn,
        uint256 amountIn,
        uint256 ethAmountReceived
    );
    event SwapTokenToToken(
        address sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event ChangeOwner(address sender, address newOwner);
    event WithdrawContractAssets(
        address sender,
        address token,
        uint256 amountWithdrew
    );

    mapping(uint256 => FeeRecipients) private RecipientsInformationById;
    mapping(address => FeeRecipients) private RecipientsInformationByAddress;
    mapping(uint256 => address) private StableCoinTracker;

    struct FeeRecipients {
        address recipient;
        uint16 amountToReceipt;
        uint256 recipientId;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier duplicateRecipient(address _newRecipient) {
        _duplicateRecipient(_newRecipient);
        _;
    }

    modifier checkRecipientExistence(address _recipient) {
        _checkRecipientExistence(_recipient);
        _;
    }

    constructor(
        address _router,
        address _factory,
        uint16 recipientFee
    ) UniswapV3Twap(_factory) {
        owner = msg.sender;
        router = _router;
        RecipientsInformationById[recipientsCounter].recipient = msg.sender;
        RecipientsInformationById[recipientsCounter]
            .amountToReceipt = recipientFee;
        RecipientsInformationById[recipientsCounter]
            .recipientId = recipientsCounter;
        RecipientsInformationByAddress[msg.sender] = RecipientsInformationById[
            recipientsCounter
        ];
        totalAttachedFees += recipientFee;
    }

    function withdrawTokenFromContract(address token) public onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        TransferHelper.safeTransfer(token, msg.sender, balance);
        emit WithdrawContractAssets(msg.sender, token, balance);
    }

    function changeOwner(address _newOwner) public onlyOwner {
        owner = _newOwner;
        emit ChangeOwner(msg.sender, _newOwner);
    }

    function setFeeForTokens(
        uint8 _numerator,
        uint24 _denominator
    ) external onlyOwner {
        numerator = _numerator;
        denominator = _denominator;
    }

    function addRecipient(
        address _receipient,
        uint16 _amountToReceipt // i.e 200 means 2% => 200 / 10000
    ) public onlyOwner duplicateRecipient(_receipient) {
        _reachMaximumPercentage(_amountToReceipt);
        recipientsCounter += 1;
        RecipientsInformationById[recipientsCounter].recipient = _receipient;
        RecipientsInformationById[recipientsCounter]
            .amountToReceipt = _amountToReceipt;
        RecipientsInformationById[recipientsCounter]
            .recipientId = recipientsCounter;
        RecipientsInformationByAddress[_receipient] = RecipientsInformationById[
            recipientsCounter
        ];
        totalAttachedFees += _amountToReceipt;
    }

    function changeRecipientFee(
        address _recipient,
        uint16 _newFeeAmount
    ) external onlyOwner checkRecipientExistence(_recipient) {
        uint16 currentFee = RecipientsInformationByAddress[_recipient]
            .amountToReceipt;
        totalAttachedFees -= currentFee;
        _reachMaximumPercentage(_newFeeAmount);
        RecipientsInformationByAddress[_recipient]
            .amountToReceipt = _newFeeAmount;
        uint256 getRecipientId = RecipientsInformationByAddress[_recipient]
            .recipientId;
        RecipientsInformationById[getRecipientId]
            .amountToReceipt = _newFeeAmount;
        totalAttachedFees += _newFeeAmount;
    }

    function addStableCoinAddress(
        address _stableCoinAddress
    ) external onlyOwner {
        stableCoinCounter += 1;
        StableCoinTracker[stableCoinCounter] = _stableCoinAddress;
    }

    function changeFeeInUsd(uint256 _newFee) public onlyOwner {
        // i.e 700000 means 0.7
        feeInUSD = _newFee;
    }

    function swapETHToTokenV3(
        address tokenOut,
        uint amountOutMin,
        uint24 fee, // Uniswap V3 fee tier (e.g., 3000 for 0.3%)
        uint160 sqrtPriceLimitX96
    ) external payable returns (uint256) {
        // Perform the swap using Uniswap V3 router
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: ISwapRouter(router).WETH9(),
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 60 seconds,
                amountIn: msg.value,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            });

        uint256 amountOut = ISwapRouter(router).exactInputSingle{
            value: msg.value
        }(params);
        uint256 amountAfterFeePaid = specifyFeeCalculation(tokenOut, amountOut);
        TransferHelper.safeTransfer(tokenOut, msg.sender, amountAfterFeePaid);
        emit SwapEthToToken(
            msg.sender,
            tokenOut,
            msg.value,
            amountAfterFeePaid
        );
        return amountOut;
    }

    function swapTokenToETHV3(
        address tokenIn,
        uint amountIn,
        uint amountOutMin,
        uint24 fee, // Uniswap V3 fee tier (e.g., 3000 for 0.3%)
        uint160 sqrtPriceLimitX96
    ) external returns (uint256) {
        require(amountIn > 0, "Zero amount!");

        TransferHelper.safeTransferFrom(
            tokenIn,
            msg.sender,
            address(this),
            amountIn
        );

        TransferHelper.safeApprove(tokenIn, router, amountIn);

        uint256 amountAfterFeePaid = specifyFeeCalculation(tokenIn, amountIn);

        // Perform the swap using Uniswap V3 router
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: ISwapRouter(router).WETH9(),
                fee: fee,
                recipient: msg.sender,
                deadline: block.timestamp + 60 seconds,
                amountIn: amountAfterFeePaid,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            });

        uint256 amountOut = ISwapRouter(router).exactInputSingle(params);
        emit SwapTokenToEth(msg.sender, tokenIn, amountIn, amountOut);
        return amountOut;
    }

    function swapTokenToTokenV3(
        address tokenIn,
        address tokenOut,
        uint amountIn,
        uint amountOutMin,
        uint24 fee, // Uniswap V3 fee tier (e.g., 3000 for 0.3%)
        uint160 sqrtPriceLimitX96
    ) external returns (uint256) {
        require(amountIn > 0, "Zero amount!");
        uint8 isFeePaid = 0;
        uint256 recipientsFee;
        bool isFirstStable = isAddressStableCoin(tokenIn);
        bool isSecondStable = isAddressStableCoin(tokenOut);

        TransferHelper.safeTransferFrom(
            tokenIn,
            msg.sender,
            address(this),
            amountIn
        );

        TransferHelper.safeApprove(tokenIn, router, amountIn);

        if (!isFirstStable && !isSecondStable) {
            recipientsFee = (amountIn * numerator) / denominator;
            amountIn -= recipientsFee;
            sendFeeToRecipients(tokenIn, recipientsFee);
            isFeePaid = 1;
        } else if ((isFirstStable && isSecondStable) || isFirstStable) {
            recipientsFee = feeInUSD;
            amountIn -= recipientsFee;
            sendFeeToRecipients(tokenIn, recipientsFee);
            isFeePaid = 1;
        }
        // Perform the swap using Uniswap V3 router
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp + 60 seconds,
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            });

        uint256 amountOut = ISwapRouter(router).exactInputSingle(params);
        if (isFeePaid == 0) {
            amountOut -= feeInUSD;
            sendFeeToRecipients(tokenOut, feeInUSD);
        }
        TransferHelper.safeTransfer(tokenOut, msg.sender, amountOut);
        emit SwapTokenToToken(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut
        );
        return amountOut;
    }

    function getRecipientById(
        uint256 _id
    ) public view returns (FeeRecipients memory) {
        return RecipientsInformationById[_id];
    }

    function getRecipientByAddress(
        address _recipient
    ) public view returns (FeeRecipients memory) {
        return RecipientsInformationByAddress[_recipient];
    }

    function getTotalAttachedFees() public view returns (uint256) {
        return totalAttachedFees;
    }

    function getAllStableCoins() public view returns (address[] memory) {
        uint j = 1;
        address[] memory stableCoins = new address[](stableCoinCounter);
        for (uint i = 0; i < stableCoinCounter; i++) {
            stableCoins[i] = StableCoinTracker[j];
            j++;
        }
        return stableCoins;
    }

    function getAllRecipients() public view returns (FeeRecipients[] memory) {
        uint j = 1;
        FeeRecipients[] memory recipients = new FeeRecipients[](
            recipientsCounter
        );
        for (uint i = 0; i < recipientsCounter; i++) {
            recipients[i] = RecipientsInformationById[j];
            j++;
        }
        return recipients;
    }

    function isAddressStableCoin(
        address givenAddress
    ) internal view returns (bool result) {
        for (uint i = 1; i <= stableCoinCounter; i++) {
            if (givenAddress == StableCoinTracker[i]) {
                return true;
            }
        }
    }

    function _reachMaximumPercentage(uint256 _amountToReceipt) internal view {
        require(
            (_amountToReceipt + totalAttachedFees) <= 10000,
            "Reached maximum!"
        );
    }

    function sendFeeToRecipients(address token, uint256 amount) internal {
        for (uint i = 1; i <= recipientsCounter; i++) {
            uint fee = (amount * RecipientsInformationById[i].amountToReceipt) /
                10000;
            TransferHelper.safeTransfer(
                token,
                RecipientsInformationById[i].recipient,
                fee
            );
        }
    }

    function specifyFeeCalculation(
        address token,
        uint256 amount
    ) internal returns (uint256) {
        uint fee;
        if (isAddressStableCoin(token)) {
            fee = feeInUSD;
            amount -= fee;
        } else {
            fee = (amount * numerator) / denominator;
            amount -= fee;
        }
        sendFeeToRecipients(token, fee);
        return amount;
    }

    function _onlyOwner() private view {
        require(msg.sender == owner, "Not owner!");
    }

    function _duplicateRecipient(address _newRecipient) private view {
        for (uint i = 1; i <= recipientsCounter; i++) {
            require(
                RecipientsInformationById[i].recipient != _newRecipient,
                "Duplicate recipient!"
            );
        }
    }

    function _checkRecipientExistence(address recipient) private view {
        require(
            RecipientsInformationByAddress[recipient].amountToReceipt != 0,
            "Recipient Existence!"
        );
    }

    receive() external payable {}
}
