/* eslint-disable node/no-missing-import */

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import axios from 'axios';

import { ethers } from 'hardhat';
import {
  AbstractProvider,
  ZeroAddress,
  parseEther,
  formatEther,
  MaxUint256,
  dataLength,
  EtherscanPlugin,
  getDefaultProvider,
} from 'ethers';

import * as fs from 'fs';
import * as rd from 'readline';
import { erc20 } from 'typechain-types/@openzeppelin/contracts/token';

import { ContractWithAddress, UserWithAddress, deploy, getUser } from 'test/useful';
import { RegressionSystem, RegressionTest, Variable } from 'test/f(x)/regression/RegressionTest';
import { features } from 'process';
import { string } from 'hardhat/internal/core/params/argumentTypes';

import { createFork } from 'test/network';

const PRECISION = 10n ** 18n;

class Etherscan {
  private etherscanURL: string;

  constructor() {
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
    if (!etherscanApiKey) {
      throw new Error('Etherscan API key not found in environment: "ETHERSCAN_API_KEY".');
    }
    this.etherscanURL = `https://api.etherscan.io/api?apikey=${etherscanApiKey}`;

    /* TODO: fix this .env madness: const rpcurl = process.env.MAINNET_RPC_URL;
    const INFURA_KEY = '3c643042a2094395bfe38f5cd1f4bc90';
    const INFURA_RPC_URL = `https://mainnet.infura.io/v3/${INFURA_KEY}`;
    const rpcurl = process.env.INFURA_RPC_URL;
    if (!rpcurl) {
      throw new Error('Etherscan API key not found in environment: "MAINNET_RPC_URL".');
    }
    this.provider = ethers.getDefaultProvider(rpcurl);
    */
    createFork(18774523);
  }

  private async callEtherscanAPI(module: string, action: string, address: string): Promise<any | null> {
    const url = `${this.etherscanURL}&module=${module}&action=${action}&address=${address}`;
    const response = await axios.get(url);
    return response.data;
  }

  private async callContractFunction(
    contractAddress: string,
    abi: any[],
    functionName: string,
    params: any[],
  ): Promise<any> {
    const [signer] = await ethers.getSigners(); // If you need to interact with state-changing functions, use a signer
    const contract = new ethers.Contract(contractAddress, abi, signer);

    const result = await contract.implementation();
    // const result = await contract[functionName](...params);
    return result;
  }

  public async getContractABI(contractAddress: string): Promise<any> {
    const result = await this.callEtherscanAPI('contract', 'getabi', contractAddress);
    if (result.status === '1') {
      const abi = JSON.parse(result.result);
      return abi;
    } else {
      throw `Error: ${result.message}`;
    }
  }

  public functions(abi: any): any[] {
    return abi.filter((prop: any) => 'type' in prop && prop.type === 'function');
  }

  public async proxy(address: string, abi: any): Promise<string> {
    for (let fn of this.functions(abi)) {
      if (fn.name == 'implementation') {
        return this.callContractFunction(address, abi, 'implementation', []);
      }
    }
    return address;
  }
}

describe('Etherscan', async () => {
  let root = '0xe7b9c7c9ca85340b8c06fb805f7775e3015108db';
  let etherscan = new Etherscan();

  beforeEach(async () => {});

  context('market', async () => {
    it('0xe7b9c7c9ca85340b8c06fb805f7775e3015108db', async () => {
      const abi = await etherscan.getContractABI(root);

      console.log('proxy "%s"', await etherscan.proxy(root, abi));
    });
  });
});
