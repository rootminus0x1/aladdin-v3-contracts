import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { ContractWithAddress, contracts, deploy, getSigner, inverse, writeEatFile, getEthPrice } from 'eat';
import { getConfig, setupBlockchain } from 'eat';
import { dig } from 'eat';
import { marketEvents, delve, delvePlot } from 'eat';

import { MockFxPriceOracle } from '@types';
import { ethers } from 'hardhat';
import { formatEther, parseEther } from 'ethers';

async function main() {
    await setupBlockchain();

    await dig();
    await delve('initial');

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

    if (getConfig().plot) {
        /*
        await delvePlot(
            marketEvents(
                { name: 'ETH', precision: 3, setMarket: setPrice },
                parseEther('4000'),
                parseEther('1010'),
                parseEther('-50'),
            ),
            [{ contract: 'stETHTreasury', functions: ['collateralRatio', 'leverageRatio'] }],
            'ratio',
        );
        */
        await delvePlot(
            marketEvents(
                { name: 'ETH', precision: 3, setMarket: setPrice },
                parseEther('4000'),
                parseEther('1010'),
                parseEther('-50'),
            ),
            [{ contract: 'stETHTreasury', functions: ['collateralRatio'] }],
            'collateral ratio',
            [{ contract: 'stETHTreasury', functions: ['leverageRatio'] }],
            'leverage ratio',
        );
    } else {
        // small price change
        await delve('2500 price', [{ name: 'ETH', precision: 0, setMarket: setPrice, value: parseEther('2500') }]);

        // above and below the 130% CR
        /*
        await delve(
            "simulate CR"
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

        // run a simulation, on base state
        await delve(
            'simulation mint, drop, mint',
            [],
            [
                getConfig().actions[0],
                { name: 'ETH', value: parseEther('1300'), setMarket: setPrice },
                getConfig().actions[0],
            ],
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
