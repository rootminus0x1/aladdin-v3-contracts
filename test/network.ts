import dotenv from "dotenv";
import dotenvExpand from 'dotenv-expand';
// TODO: these must be a better way of importing NumberLike
import type { NumberLike } from "@nomicfoundation/hardhat-network-helpers/src/types";

import { reset, time, impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

dotenvExpand.expand(dotenv.config());

export async function createFork(block?: NumberLike) {
  const url = process.env.MAINNET_URL;
  console.log("forking %s", url);
  await reset(url, block);
}

export async function impersonateAccounts(accounts: string[]) {
  for (const address of accounts) {
    impersonateAccount(address);
  }
}

/*
export async function rollFork(block: NumberLike) {
  await reset(undefined, block);
  console.log("requested block=%s", block);
  console.log("latest block=%s", await time.latest());
}
*/

/*
// eslint-disable-next-line camelcase
export async function request_fork(blockNumber: number, accounts: string[]) {
  await hre.network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.HARDHAT_FORK_URL,
          blockNumber: blockNumber,
        },
      },
    ],
  });
  for (const address of accounts) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });
  }
}
*/
