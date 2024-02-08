import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { ethers } from 'hardhat';
import { parseEther } from 'ethers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

import { contracts, deploy, getEthPrice, doUserEvent, day, events, week, asDateString } from 'eat';
import { getConfig, setupBlockchain } from 'eat';
import { dig } from 'eat';
import { marketEvents, delve, delvePlot } from 'eat';

import { MockFxPriceOracle } from '@types';

async function main() {
    await setupBlockchain();
    const startEthPrice = await getEthPrice(getConfig().timestamp);

    // TODO: scan event logs for events like UpdateSettleWhitelist(_account, _status)
    // the description of what parameters to gleem and how they are presented (array of addresses)
    // to the diagram - I think this is just another measure - does etherscan have events?
    await dig();

    if (!getConfig().plot) {
        //await delve('initial');
    }
    // TODO: some of this initialisation should be done on demand, rather than the existence of a contract
    if (contracts.stETHTreasury) {
        // handle price changes
        const oracle = await deploy<MockFxPriceOracle>('MockFxPriceOracle');
        await contracts.stETHTreasury.connect(contracts.stETHTreasury.ownerSigner).updatePriceOracle(oracle.address);

        const setPrice = async (value: bigint) => {
            await oracle.setPrice(value);
            return value;
        };

        let prevDate = await time.latest(); // use this to make us immune to snapshot restores
        let incrememt = 2 * week;
        const setPriceAndRoll = async (value: bigint) => {
            await oracle.setPrice(value);
            await doUserEvent(events.harvest); // maybe a less intrusive way to do this
            const target = prevDate + incrememt;
            // console.log(`moving time to ${asDateString(target)}...`);
            await time.increaseTo(target);
            prevDate = await time.latest();
            return value;
        };

        // TODO: set the price according to stETHTreasury.getCurrentNav._baseNav
        await setPrice(startEthPrice); // set to the current eth price, like nothing had changed (approx)

        const getCR = async () => {
            return contracts.stETHTreasury.collateralRatio();
        };

        if (getConfig().plot) {
            // TODO: plot the below against a beta = 0 set up
            // TODO: could do a plot of beta against collateral ratio, would like beta=0 to have the highest, I suspect it doesn't
            // TODO: plot collateral ratio against minted x & f tokens, base the amount on the current collateral stETHTreasury.totalBaseToken
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

            //await ethers.provider.send('evm_setAutomine', [false]);

            await delvePlot(
                'CRxETH',
                marketEvents(
                    { name: 'ETH', precision: 3, setMarket: setPriceAndRoll },
                    parseEther('4000'),
                    parseEther('10'),
                    parseEther('-100'),
                ),
                [],
                [{ contract: 'stETHTreasury', functions: ['collateralRatio'] }],
                'collateral ratio',
                [{ contract: 'stETHTreasury', functions: ['leverageRatio'] }],
                'leverage ratio',
            );
        } else {
            // TODO: drive a collateral ratio < 130% with eth price. then run a liquidation bot to see what changes
            // beforehand either get a depositor's address, or deposit some from one of my users
            // TODO: when running the liquidator bot, we should get the return values of the liquidate function - see doUserEvent in delve.ts
            // TODO: run a couple of deposits with a reward cycle between them and see the rewards distributed
            // TODO: reserve pool?
            // small price change
            // await delve('2500 price', [{ name: 'ETH', precision: 0, setMarket: setPrice, value: parseEther('2500') }]);

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
                    events.mintFToken_1000eth,
                    { name: 'ETH', value: parseEther('1300'), setMarket: setPrice },
                    events.mintFToken_1000eth,
                ],
            );
        }
    }
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
