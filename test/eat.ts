import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { ContractWithAddress, VariableSetter, contracts, deploy, getSigner, inverse, writeEatFile } from 'eat';
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
    const setPrice = async (value: bigint) => {
        await oracle.setPrice(value);
    };

    const getCR = async () => {
        return contracts.stETHTreasury.collateralRatio();
    };

    // TODO: handle multiple variables?
    // TODO: remove number - it's either a string for presentation or a bigint for calcs

    if (getConfig().plot) {
        await delvePlot(
            await Values('ETH', 3, valuesStepped(parseEther('4000'), parseEther('1010'), parseEther('-50')), setPrice),
            [{ contract: 'stETHTreasury', functions: ['collateralRatio', 'leverageRatio'] }],
        );
    } else {
        // small price change
        //await delve(await Values('ETH', valuesSingle(2500), setPrice));
        // above and below the 130% CR

        await delve(
            await Values(
                'ETH',
                3,
                valuesSingle(
                    (await inverse(
                        parseEther('1.3'),
                        getCR,
                        setPrice,
                        parseEther('1030'),
                        parseEther('10000'),
                        parseEther('0.0001'),
                    )) || 0n,
                ),
                setPrice,
            ),
        );
    }
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
