
import { BaseContract } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";

export type ContractWithAddress<T extends BaseContract> = T & { address: string; };

export async function deploy<T extends BaseContract> (factoryName: string,
  deployer: SignerWithAddress /*HardhatEthersSigner*/,
  ...deployArgs: any[]): Promise<ContractWithAddress<T>> {
  const contractFactory = await ethers.getContractFactory(factoryName, deployer);
  const contract = await contractFactory.deploy(...deployArgs);
  await contract.waitForDeployment();

  return Object.assign(
    contract as T,
    { address: await contract.getAddress() },
    ) as ContractWithAddress<T>;
}