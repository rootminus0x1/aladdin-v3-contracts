import { BaseContract, Wallet } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

// TODO: consider adding this to network.ts

export type ContractWithAddress<T extends BaseContract> = T & { name: string; address: string };
export type UserWithAddress = SignerWithAddress & { name: string; address: string };

export async function deploy<T extends BaseContract>(
  factoryName: string,
  deployer: SignerWithAddress /*HardhatEthersSigner*/,
  ...deployArgs: any[]
): Promise<ContractWithAddress<T>> {
  const contractFactory = await ethers.getContractFactory(factoryName, deployer);
  const contract = await contractFactory.deploy(...deployArgs);
  await contract.waitForDeployment();

  return Object.assign(contract as T, {
    name: factoryName,
    address: await contract.getAddress(),
  }) as ContractWithAddress<T>;
}

let allSigners = ethers.getSigners();
let allocatedSigners = 0;

export async function getUser(name: string): Promise<UserWithAddress> {
  return Object.assign((await allSigners)[allocatedSigners++] as SignerWithAddress, { name: name }) as UserWithAddress;
}

/*
export type NamedAddress = { name: string; address: string }

export type User = NamedAddress & SignerWithAddress;
export type Token<T extends BaseContract> = NamedAddress & ContractWithAddress<T>;
export type Contract<T extends BaseContract> = NamedAddress & ContractWithAddress<T>;
*/
