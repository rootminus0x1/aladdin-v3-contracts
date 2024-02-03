import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import {
    ContractWithAddress,
    VariableSetter,
    contracts,
    delveSimulation,
    deploy,
    getSigner,
    inverse,
    writeEatFile,
    getEthPrice,
} from 'eat';
import { getConfig, setupBlockchain } from 'eat';
import { dig } from 'eat';
import { Values, valuesStepped, valuesSingle, delve, delvePlot } from 'eat';

import { MockFxPriceOracle } from '@types';
import { ethers } from 'hardhat';
import { formatEther, parseEther } from 'ethers';

async function main() {
    await setupBlockchain();

    await dig();

    // handle price changes
    const oracle = await deploy<MockFxPriceOracle>('MockFxPriceOracle');
    await contracts.stETHTreasury.connect(contracts.stETHTreasury.ownerSigner).updatePriceOracle(oracle.address);
    const setPrice = async (value: bigint) => {
        await oracle.setPrice(value);
    };
    setPrice(await getEthPrice(getConfig().timestamp)); // set to the current eth price, like nothing had changed (approx)

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
        /*
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
    */
        await delveSimulation([
            getConfig().actions[0],
            { name: 'ETH', value: parseEther('1300'), setTheMarket: setPrice },
            getConfig().actions[0],
        ]);
    }
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
