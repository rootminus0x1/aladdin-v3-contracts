import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { ContractWithAddress, contracts, deploy, getSigner, writeEatFile } from 'eat';
import { getConfig, setupBlockchain } from 'eat';
import { dig } from 'eat';
import { Values, valuesStepped, valuesSingle, delve, delvePlot } from 'eat';

import { MockFxPriceOracle } from '@types';
import { ethers } from 'hardhat';
import { formatEther, parseEther } from 'ethers';

async function main() {
    await setupBlockchain();

    await dig();

    if (!getConfig().plot) {
        await delve(); // no price change
    }

    // handle price changes
    const oracle = await deploy<MockFxPriceOracle>('MockFxPriceOracle');
    await contracts.stETHTreasury.connect(contracts.stETHTreasury.ownerSigner).updatePriceOracle(oracle.address);
    const setPrice = async (value: string) => {
        await oracle.setPrice(parseEther(value));
    };

    // TODO: handle multiple variables?

    if (getConfig().plot) {
        await delvePlot(await Values('ETH', valuesStepped(4000, 1010, -50), setPrice), [
            { contract: 'stETHTreasury', functions: ['collateralRatio', 'leverageRatio'] },
        ]);
    } else {
        await delve(await Values('ETH', valuesSingle(2500), setPrice)); // price change
    }
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
