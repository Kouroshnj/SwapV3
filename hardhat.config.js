require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config()

const { API_URL, PRIVATE_KEY, CHAIN_ID, API_KEY, ARBITRUM_URL, ARBITRUM_CHAINID, BSC_URL, BSC_CHAINID } = process.env

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "localhost",
  sourcify: {
    enabled: true
  },
  mocha: {
    timeout: 100000000
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },

    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 5777
    },

    sepolia: {
      url: API_URL,
      accounts: [`0x${PRIVATE_KEY}`],
      chainId: parseInt(CHAIN_ID)
    },

    arbitrumSepolia: {
      url: ARBITRUM_URL,
      accounts: [`0x${PRIVATE_KEY}`],
      chainId: parseInt(ARBITRUM_CHAINID)
    },

    binanceSmartChain: {
      url: BSC_URL,
      accounts: [`0x${PRIVATE_KEY}`],
      chainId: parseInt(BSC_CHAINID)
    },

    hardhat: {
      forking: {
        url: "https://mainnet.infura.io/v3/2705870f147d42619c80a9476149b79e",
        gas: 30000000,
        blockNumber: 21020966
      }
    },
  },
  etherscan: {
    apiKey: API_KEY
  },
  solidity: {
    compilers: [
      {
        version: "0.8.10"
      }
    ]
  }
};
