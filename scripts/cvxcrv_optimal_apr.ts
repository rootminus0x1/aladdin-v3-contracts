/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import axios from "axios";
import * as hre from "hardhat";
import "@nomicfoundation/hardhat-ethers";
import { IConvexBasicRewards, IConvexToken, ICvxCrvStakingWrapper, IMulticall2 } from "../typechain";
import { TOKENS } from "./utils";
import { BytesLike, Interface, Result } from "ethers";
import { Command } from "commander";
import { plot } from "asciichart";
import assert from "assert";

const program = new Command();
program.version("1.0.0");

const ethers = hre.ethers;
const MULLTICALL2 = "0x5ba1e12693dc8f9c48aad8770482f4739beed696";
const STAKED_CVXCRV = "0xaa0C3f5F7DFD688C6E646F66CD2a6B66ACdbE434";
const HALFPRECISION: bigint = 10n ** 9n;

interface ICoinGeckoResponse {
  [symbol: string]: {
    [currency: string]: number;
  };
}

const MaxSupply = 10n ** (18n + 2n + 6n);

function ratio(a: bigint, b: bigint): number {
  return Number(a * HALFPRECISION / b / HALFPRECISION); // TODO: is this functiom needed with bigint?
}

function as_float(x: BigInt): number {
  return parseFloat(ethers.formatEther(Number(x)));
}

async function doMulticall(
  calls: { target: string; interface: Interface; method: string; param: any[] }[],
  block: number
): Promise<Result[]> {
  const multicall = (await ethers.getContractAt("IMulticall2", MULLTICALL2)) as IMulticall2;
  const [, results] = await multicall.callStatic.aggregate(
    calls.map((x) => {
      return {
        target: x.target,
        callData: x.interface.encodeFunctionData(x.method, x.param),
      };
    }),
    { blockTag: block }
  );
  return results.map((r: BytesLike, index: number) => {
    const call = calls[index];
    return call.interface.decodeFunctionResult(call.method, r);
  });
}

async function computeCVX(amount: bigint, contract: IConvexToken, block: number): Promise<bigint> {
  const contractAddress = await contract.getAddress();
  const results = await doMulticall(
    [
      { target: contractAddress, interface: contract.interface, method: "totalSupply", param: [] },
      { target: contractAddress, interface: contract.interface, method: "reductionPerCliff", param: [] },
      { target: contractAddress, interface: contract.interface, method: "totalCliffs", param: [] },
    ],
    block
  );

  const supply: bigint = results[0][0];
  const reductionPerCliff: bigint = results[1][0];
  const totalCliffs: bigint = results[2][0];

  if (supply == 0n) return amount;

  const cliff = supply / reductionPerCliff;
  if (cliff < totalCliffs) {
    const reduction = totalCliffs - cliff;
    amount = amount * reduction /totalCliffs;
    const amtTillMax = MaxSupply - supply;
    if (amount > amtTillMax) {
      amount = amtTillMax;
    }

    return amount;
  } else {
    return 0n;
  }
}

async function computeRewardsInDay(
  contract: IConvexBasicRewards,
  block: number,
  timestamp: number
): Promise<bigint> {
  const contractAddress = await contract.getAddress();
  const results = await doMulticall(
    [
      { target: contractAddress, interface: contract.interface, method: "periodFinish", param: [] },
      { target: contractAddress, interface: contract.interface, method: "rewardRate", param: [] },
      {
        target: contractAddress,
        interface: contract.interface,
        method: "balanceOf",
        param: [STAKED_CVXCRV],
      },
      { target: contractAddress, interface: contract.interface, method: "totalSupply", param: [] },
    ],
    block
  );

  const periodFinish = results[0][0];
  const rewardRate = results[1][0];
  const balanceOf = results[2][0];
  const totalSupply = results[3][0];

  if (periodFinish <= timestamp) return 0n;
  let duration = periodFinish - timestamp;
  // if (duration > 86400) duration = 86400;
  duration = 86400;
  return BigInt(rewardRate * duration * balanceOf / totalSupply);
}

async function main(holder: string) {
  const crvRewards = (await ethers.getContractAt(
    "IConvexBasicRewards",
    "0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e"
  )) as IConvexBasicRewards;
  const threeCRVRewards = (await ethers.getContractAt(
    "IConvexBasicRewards",
    "0x7091dbb7fcbA54569eF1387Ac89Eb2a5C9F6d2EA"
  )) as IConvexBasicRewards;
  const extraCVXRewards = (await ethers.getContractAt(
    "IConvexBasicRewards",
    "0x449f2fd99174e1785CF2A1c79E665Fec3dD1DdC6"
  )) as IConvexBasicRewards;
  const cvx = (await ethers.getContractAt("IConvexToken", TOKENS.CVX.address)) as IConvexToken;
  const stakedCvxCrv = (await ethers.getContractAt("ICvxCrvStakingWrapper", STAKED_CVXCRV)) as ICvxCrvStakingWrapper;

  const block = await ethers.provider.getBlock("latest");
  assert(block != null);

  // fetch rewards
  const amountCRV = await computeRewardsInDay(crvRewards, block.number, block.timestamp);
  const amountCVX = await computeCVX(amountCRV, cvx, block.number);
  const amount3CRV = await computeRewardsInDay(threeCRVRewards, block.number, block.timestamp);
  const amountExtraCVX = await computeRewardsInDay(extraCVXRewards, block.number, block.timestamp);

  console.log(
    "CRV rewards:",
    ethers.formatEther(amountCRV),
    "3CRV rewards:",
    ethers.formatEther(amount3CRV),
    "CVX rewards:",
    ethers.formatEther(amountCVX),
    "extra CVX rewards:",
    ethers.formatEther(amountExtraCVX)
  );

  // fetch price
  const response = await axios.get<ICoinGeckoResponse>(
    "https://api.coingecko.com/api/v3/simple/price?ids=convex-crv%2Ccurve-dao-token%2Cconvex-finance%2Clp-3pool-curve&vs_currencies=usd"
  );
  const priceCRV = response.data["curve-dao-token"].usd;
  const price3CRV = response.data["lp-3pool-curve"].usd;
  const priceCVX = response.data["convex-finance"].usd;
  const priceCvxCrv = response.data["convex-crv"].usd;
  console.log("CRV price:", priceCRV, "3CRV price:", price3CRV, "CVX price:", priceCVX, "cvxCRV price:", priceCvxCrv);

  // fetch weight
  const results = await doMulticall(
    [
      {
        target: STAKED_CVXCRV,
        interface: stakedCvxCrv.interface,
        method: "rewardSupply",
        param: [0],
      },
      {
        target: STAKED_CVXCRV,
        interface: stakedCvxCrv.interface,
        method: "rewardSupply",
        param: [1],
      },
      {
        target: STAKED_CVXCRV,
        interface: stakedCvxCrv.interface,
        method: "balanceOf",
        param: [holder],
      },
      {
        target: STAKED_CVXCRV,
        interface: stakedCvxCrv.interface,
        method: "userRewardWeight",
        param: [holder],
      },
      {
        target: STAKED_CVXCRV,
        interface: stakedCvxCrv.interface,
        method: "userRewardBalance",
        param: [holder, 0],
      },
      {
        target: STAKED_CVXCRV,
        interface: stakedCvxCrv.interface,
        method: "userRewardBalance",
        param: [holder, 1],
      },
    ],
    block.number
  );
  const supply0: bigint = results[0][0];
  const supply1: bigint = results[1][0];
  const bal_me: bigint = results[2][0];
  const weight_me: bigint = results[3][0];
  const bal0_me: bigint = results[4][0];
  const bal1_me: bigint = results[5][0];

  const reward0USD =
    as_float(amountCRV) * priceCRV + as_float(amountCVX) * priceCVX + as_float(amountExtraCVX) * priceCVX;
  const reward1USD = as_float(amount3CRV) * price3CRV;
  const balanceUSD = as_float(bal_me) * priceCvxCrv;
  const currentDailyRewardUSD = ratio(bal0_me, supply0) * reward0USD + ratio(bal1_me, supply1) * reward1USD;
  console.log("block:", block.number);
  console.log("holder:", holder);
  console.log("\nCurrent Status:");
  console.log(" + totalSupplyGroup0:", ethers.formatEther(supply0));
  console.log(" + totalSupplyGroup1:", ethers.formatEther(supply1));
  console.log(" + holderBalanceOf:", ethers.formatEther(bal_me));
  console.log(" + holderWeight:", (Number(weight_me) / 10000).toFixed(4));
  console.log(" + holderBalanceGroup0:", ethers.formatEther(bal0_me), "ratio:", ratio(bal0_me, supply0));
  console.log(" + holderBalanceGroup1:", ethers.formatEther(bal1_me), "ratio:", ratio(bal1_me, supply1));
  console.log(
    ` + dailyRewardUSD: ${currentDailyRewardUSD.toFixed(4)},`,
    `daily APR: ${((currentDailyRewardUSD / balanceUSD) * 100).toFixed(4)}%,`,
    `yearly APR: ${((currentDailyRewardUSD / balanceUSD) * 100 * 365).toFixed(4)}%,`,
    `yearly APY: ${((Math.pow(currentDailyRewardUSD / balanceUSD + 1, 365) - 1) * 100).toFixed(4)}%`
  );

  // do adjust computation
  const S0 = as_float(supply0 - bal0_me);
  const S1 = as_float(supply1 - bal1_me);
  const k = Math.sqrt((reward1USD * S1) / (reward0USD * S0));
  let w = (k * (as_float(bal_me) + S0) - S1) / ((1 + k) * as_float(bal_me));
  if (w < 0) w = 0;
  if (w > 1) w = 1;

  const adjusted_bal0_me = bal_me * BigInt(Math.floor((1 - w) * 10000)) / 10000n;
  const adjusted_bal1_me = bal_me - adjusted_bal0_me;
  const adjusted_supply0 = supply0 - bal0_me + adjusted_bal0_me;
  const adjusted_supply1 = supply1 - bal1_me + adjusted_bal1_me;
  const adjustedCurrentDailyRewardUSD =
    ratio(adjusted_bal0_me, adjusted_supply0) * reward0USD + ratio(adjusted_bal1_me, adjusted_supply1) * reward1USD;
  console.log("\nAdjusted Status:");
  console.log(" + totalSupplyGroup0:", ethers.formatEther(adjusted_supply0));
  console.log(" + totalSupplyGroup1:", ethers.formatEther(adjusted_supply1));
  console.log(" + holderBalanceOf:", ethers.formatEther(bal_me));
  console.log(" + holderWeight:", w.toFixed(4));
  console.log(
    " + holderBalanceGroup0:",
    ethers.formatEther(adjusted_bal0_me),
    "ratio:",
    ratio(adjusted_bal0_me, adjusted_supply0)
  );
  console.log(
    " + holderBalanceGroup1:",
    ethers.formatEther(adjusted_bal1_me),
    "ratio:",
    ratio(adjusted_bal1_me, adjusted_supply1)
  );
  console.log(
    ` + dailyRewardUSD: ${adjustedCurrentDailyRewardUSD.toFixed(4)}`,
    `daily APR: ${((adjustedCurrentDailyRewardUSD / balanceUSD) * 100).toFixed(4)}%,`,
    `yearly APR: ${((adjustedCurrentDailyRewardUSD / balanceUSD) * 100 * 365).toFixed(4)}%,`,
    `yearly APY: ${((Math.pow(adjustedCurrentDailyRewardUSD / balanceUSD + 1, 365) - 1) * 100).toFixed(4)}%`
  );

  const getApy = (weight: number) => {
    const adjusted_bal0_me = bal_me * BigInt(Math.floor((1 - weight) * 10000)) / 10000n;
    const adjusted_bal1_me = bal_me -adjusted_bal0_me;
    const adjusted_supply0 = supply0 - bal0_me + adjusted_bal0_me;
    const adjusted_supply1 = supply1 - bal1_me + adjusted_bal1_me;
    const adjustedCurrentDailyRewardUSD =
      ratio(adjusted_bal0_me, adjusted_supply0) * reward0USD + ratio(adjusted_bal1_me, adjusted_supply1) * reward1USD;
    return (adjustedCurrentDailyRewardUSD / balanceUSD) * 100 * 365;
  };
  const aprList = new Array(101);
  let maxAPR = 0;
  let maxWeight = 0;
  for (let i = 0; i <= 10000; i++) {
    const apr = getApy(i / 10000);
    if (apr > maxAPR) {
      maxAPR = apr;
      maxWeight = i / 10000;
    }
    if (i % 100 === 0) {
      aprList[i / 100] = apr;
    }
  }
  console.log(`\nOptimal APR: ${maxAPR.toFixed(4)}%,`, `Optimal Weight: ${maxWeight.toFixed(4)}`);
  console.log(
    plot(aprList, {
      height: 50,
    })
  );
}

program.option("--holder <holder>", "the address of stkCvxCrv holder");
program.parse(process.argv);
const options = program.opts();

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main(options.holder).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
