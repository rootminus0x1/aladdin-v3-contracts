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
  let address = await contract.getAddress();

  //console.log("%s = %s", address, factoryName);

  return Object.assign(contract as T, {
    name: factoryName,
    address: address,
  }) as ContractWithAddress<T>;
}

let allSigners = ethers.getSigners();
let allocatedSigners = 0;

export async function getUser(name: string): Promise<UserWithAddress> {
  let signer = (await allSigners)[allocatedSigners++] as SignerWithAddress;
  //console.log("%s = %s", signer.address, name);
  return Object.assign(signer, { name: name }) as UserWithAddress;
}

/*
export type NamedAddress = { name: string; address: string }

export type User = NamedAddress & SignerWithAddress;
export type Token<T extends BaseContract> = NamedAddress & ContractWithAddress<T>;
export type Contract<T extends BaseContract> = NamedAddress & ContractWithAddress<T>;
*/
