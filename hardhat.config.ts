import dotenv from "dotenv";
dotenv.config();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
require("hardhat-gas-reporter");
require("solidity-coverage");
require("hardhat-docgen");

const privateKey = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 9999,
      },
    },
  },
  networks: {
    //   development: {
    //     url: "http://127.0.0.1:7545",
    //     port: 7545,
    //   },
    // Ethereum networks
    main: {
      url: `${process.env.API_KEY_ETH}`,
      accounts: [privateKey],
      chainId: 1,
    },
    goerli: {
      url: `${process.env.API_KEY_GOERLI}`,
      accounts: [privateKey],
      chainId: 5,
    },
    // Polygon networks
    polygon: {
      url: `${process.env.API_KEY_POLYGON}`,
      accounts: [privateKey],
      chainId: 137,
    },
    mumbai: {
      url: `${process.env.API_KEY_MUMBAI}`,
      accounts: [privateKey],
      chainId: 80001,
    },
    // BNB Chain networks
    bnb_chain: {
      url: `${process.env.API_NODE_BSC}`,
      accounts: [privateKey],
      chainId: 56,
    },
    bnb_testnet: {
      url: `${process.env.API_NODE_BSC_TEST}`,
      accounts: [privateKey],
      chainId: 97,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  contractSizer: {
    runOnCompile: true,
    strict: true,
  },
  docgen: {
    path: "./docs",
    clear: true,
    extension: "md",
    runOnCompile: true,
    "output-structure": "single",
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    "allow-uncaught": true,
    diff: true,
    extension: ["js"],
    recursive: true,
    reporter: "spec",
    require: ["hardhat/register"],
    slow: 0,
    spec: "test/**/*.test.js",
    timeout: 0,
    ui: "bdd",
    watch: false,
    "watch-files": ["contracts/**/*.sol", "test/**/*.js"],
    "watch-ignore": ["node_modules", ".git"],
  },
};
