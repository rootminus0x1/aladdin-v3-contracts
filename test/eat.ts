import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { ContractWithAddress, contracts, deploy, getConfig, getSigner, write } from 'eat';
import { mermaid } from 'eat';
import { asDateString } from 'eat';
import { setupBlockchain } from 'eat';
import { dig } from 'eat';
import { delve } from 'eat';

import { MockFxPriceOracle } from '@types';

async function main() {
    // TODO: replace with a simple initialise function and add timestamp to config, etc
    const timestamp = await setupBlockchain(getConfig().block, false);

    await dig();

    // mock the price oracle

    // TODO: hide deployer (make a global like whale, or maybe use whale?)
    const deployer = await getSigner('deployer');
    let oracle: ContractWithAddress<MockFxPriceOracle>;
    oracle = await deploy<MockFxPriceOracle>('MockFxPriceOracle', deployer);

    // find the stETHTreasury owner

    // need to find the owner of Treasury
    await contracts.stETHTreasury.connect(contracts.stETHTreasury.owner).updatePriceOracle(oracle);

    // output a diagram
    write('diagram.md', await mermaid(getConfig().block, asDateString(timestamp), getConfig().diagram));

    await delve();
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
