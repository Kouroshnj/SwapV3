//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";

contract UniswapV3Twap {
    address public factory;

    constructor(address _factory) {
        factory = _factory;
    }

    function estimateAmountOut(
        address tokenIn,
        address tokenOut,
        uint128 amountIn,
        uint24 fee,
        uint32 secondsAgo
    ) internal view returns (uint amountOut) {
        address pool = isPoolExist(tokenIn, tokenOut, fee);

        // (int24 tick, ) = OracleLibrary.consult(pool, secondsAgo);

        // Code copied from OracleLibrary.sol, consult()
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        // int56 since tick * time = int24 * uint32
        // 56 = 24 + 32
        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(pool).observe(
            secondsAgos
        );

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

        // int56 / uint32 = int24
        int24 tick = int24(tickCumulativesDelta / int32(secondsAgo));
        // Always round to negative infinity
        /*
        int doesn't round down when it is negative

        int56 a = -3
        -3 / 10 = -3.3333... so round down to -4
        but we get
        a / 10 = -3

        so if tickCumulativeDelta < 0 and division has remainder, then round
        down
        */
        if (
            tickCumulativesDelta < 0 &&
            (tickCumulativesDelta % int32(secondsAgo) != 0)
        ) {
            tick--;
        }

        amountOut = OracleLibrary.getQuoteAtTick(
            tick,
            amountIn,
            tokenIn,
            tokenOut
        );
    }

    function callEstimateAmountOut(
        IERC20 _tokenIn,
        IERC20 _tokenOut,
        uint128 _amountIn,
        uint24 _fee,
        uint32 _secondsAgo
    ) public view returns (uint amountOut) {
        return
            estimateAmountOut(
                address(_tokenIn),
                address(_tokenOut),
                _amountIn,
                _fee,
                _secondsAgo
            );
    }

    function priceOfOneUSDTinMML(
        uint price
    ) public pure returns (uint amountOut) {
        price /= 10 ** 6;
        return 2246238172973155145 * price;
    }

    function isPoolExist(
        address token0,
        address token1,
        uint24 fee
    ) internal view returns (address) {
        address pool = IUniswapV3Factory(factory).getPool(token0, token1, fee);
        require(pool != address(0), "pool doesn't exist");
        return pool;
    }
}
