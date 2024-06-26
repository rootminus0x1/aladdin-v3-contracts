//import * as dotenv from "dotenv";
//import { ProxyAgent, setGlobalDispatcher } from "undici";

import { HardhatUserConfig } from 'hardhat/config';
// import "tsconfig-paths";
// import "@nomicfoundation/hardhat-verify";
import '@nomicfoundation/hardhat-ethers';
// import "@nomicfoundation/hardhat-chai-matchers";
// import * as hre from "hardhat";
import '@typechain/hardhat';
// import fs from "fs";
// import "hardhat-preprocessor";
// import "hardhat-gas-reporter";
// import "solidity-coverage";

//import "@nomicfoundation/hardhat-foundry";

//dotenv.config();

//if (process.env.PROXY) {
//  const proxyAgent = new ProxyAgent(process.env.PROXY);
//  setGlobalDispatcher(proxyAgent);
//}

// const accounts = process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [];

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

// function getRemappings() {
//     return fs
//         .readFileSync('remappings.txt', 'utf8')
//         .split('\n')
//         .filter(Boolean) // remove empty lines
//         .map((line: string) => line.trim().split('='));
// }

const config: HardhatUserConfig = {
    //   preprocess: {
    //     eachLine: (hre) => ({
    //       transform: (line: string) => {
    //         if (line.match(/^\s*import /i)) {
    //           // match all lines with `import `
    //           for (const [from, to] of getRemappings()) {
    //             if (line.includes(from)) {
    //               line = line.replace(from, to);
    //               break;
    //             }
    //           }
    //         }
    //         return line;
    //       },
    //     }),
    //   },
    solidity: {
        compilers: [
            // {
            //     version: '0.6.2',
            //     settings: {
            //         optimizer: {
            //             enabled: true,
            //             runs: 200,
            //         },
            //     },
            // },
            {
                version: '0.6.12',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 1,
                    },
                },
            },
            {
                version: '0.7.6',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.8.0',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.8.10',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.8.12',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
            {
                version: '0.8.20',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    paths: {
        sources: './eat-source/fxUSD-wstETH', // Path to Solidity files
        //tests: "./custom_tests",
        cache: './eat-cache/solidity',
        artifacts: './eat-cache/artifacts',
    },
    //   networks: {
    //     hardhat: {
    //       accounts: {
    //         accountsBalance: "1000000000000000000000000", // 1,000,000 eth
    //       },
    //     },
    //     mainnet: {
    //       url: process.env.MAINNET_URL || "https://rpc.ankr.com/eth",
    //       chainId: 1,
    //       accounts: [process.env.PRIVATE_KEY_MAINNET!],
    //     },
    //     goerli: {
    //       url: process.env.GOERLI_URL || "https://rpc.ankr.com/eth_goerli",
    //       chainId: 5,
    //       accounts,
    //     },
    //     sepolia: {
    //       url: process.env.SEPOLIA_URL || "https://rpc.sepolia.org",
    //       chainId: 11155111,
    //       accounts,
    //     },
    //     hermez: {
    //       url: process.env.HERMEZ_URL || "https://zkevm-rpc.com",
    //       chainId: 1101,
    //       accounts: [process.env.PRIVATE_KEY_HERMEZ!],
    //     },
    //     fork_mainnet_10540: {
    //       url: process.env.MAINNET_FORK_10540_URL || "",
    //       accounts,
    //     },
    //     fork_mainnet_10547: {
    //       url: process.env.MAINNET_FORK_10547_URL || "",
    //       accounts,
    //     },
    //     fork_mainnet_10548: {
    //       url: process.env.MAINNET_FORK_10548_URL || "",
    //       accounts,
    //     },
    //   },
    typechain: {
        outDir: './eat-typechain-types',
        target: 'ethers-v6',
    },
    //   gasReporter: {
    //     enabled: process.env.REPORT_GAS !== undefined,
    //     currency: "USD",
    //   },
    //   etherscan: {
    //     apiKey: process.env.ETHERSCAN_API_KEY,
    //     customChains: [
    //       {
    //         network: "hermez",
    //         chainId: 1101,
    //         urls: {
    //           apiURL: "https://api-zkevm.polygonscan.com/api",
    //           browserURL: "https://zkevm.polygonscan.com",
    //         },
    //       },
    //     ],
    //   },
    //   mocha: {
    //     timeout: 400000,
    //   },
};

export default config;
