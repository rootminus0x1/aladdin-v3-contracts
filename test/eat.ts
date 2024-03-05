import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { ethers } from 'hardhat';
import { MaxUint256, formatEther, parseEther } from 'ethers';
import { mine, setBalance, time } from '@nomicfoundation/hardhat-network-helpers';

import {
    contracts,
    deploy,
    getEthPrice,
    doTrigger,
    triggerTemplate,
    Role,
    parseTime,
    asDateString,
    writeReadings,
    makeTrigger,
    Trigger,
    mermaid,
    users,
    getSigner,
    nodes,
    digOne,
    addTokenToWhale,
    whale,
    readingsDeltas,
    withLogging,
    writeDiagram,
    writeReadingsDelta,
    Reading,
    log,
    makeTriggerSeries,
    TriggerTemplate,
    delvePlot,
    findReader,
    callReader,
    findDeltaReader,
    makeReader,
    makeCalculator,
    digUsers,
    augment,
    inverse,
    makeTriggerList,
    eatFileName,
    writeEatFile,
    IEat,
    eatMain,
} from 'eat';
import { getConfig, setupBlockchain, getSignerAt } from 'eat';
import { dig } from 'eat';
import { delve } from 'eat';

import { MockFxPriceOracle, StETHTreasury__factory } from '@types';
import { writeFile } from 'fs';
import { JSONreplacer } from 'lib/eat/src/friendly';
import { makeCRTrigger, makeEthPriceTemplate, makeLiquidateTrigger } from './triggers';
import { calculateCR } from './readers';

class EatCollateralRatio implements IEat {
    public name = 'CR';

    public addContracts = async () => {
        //const startEthPrice = await getEthPrice(getConfig().timestamp);
        const baseNav = (await contracts.stETHTreasury.getCurrentNav())._baseNav;

        //log(`${(await callReader(findReader('stETHTreasury', 'collateralRatio'))).value}`);
        //log(`${(await callReader(findReader('stETH', 'balanceOf', '', 'stETHTreasury'))).value}`);
        //log(`${(await callReader(findReader('fETH', 'totalSupply'))).value}`);

        // add the mock price contract
        await deploy<MockFxPriceOracle>('MockFxPriceOracle');
        await contracts.stETHTreasury
            .connect(contracts.stETHTreasury.ownerSigner)
            .updatePriceOracle(contracts.MockFxPriceOracle.address);

        const tx = await contracts.MockFxPriceOracle.setPrice(baseNav);

        //await makeCRTrigger(parseEther('1.3'));
    };

    public doStuff = async (base: Reading) => {
        // above and below the 130% CR
        for (const [pool, wrapper, liquidatorContract] of [
            ['RebalancePool', 'wstETHWrapper', 'RebalanceWithBonusToken__0'],
            ['BoostableRebalancePool__wstETHWrapper', 'wstETHWrapper', 'RebalanceWithBonusToken__1'],
            ['BoostableRebalancePool__StETHAndxETHWrapper', 'StETHAndxETHWrapper', 'RebalanceWithBonusToken__2'],
        ]) {
            // currently ratios are (from etherscan):
            //stabilityRatio   uint64 :  1305500000000000000
            //liquidationRatio   uint64 :  1206700000000000000
            //selfLiquidationRatio   uint64 :  1143900000000000000
            //recapRatio   uint64 :  1000000000000000000
            //                      1.3055    1.2067    1.1439    1.0000
            for (const cr of ['1.3100', '1.2500', '1.1700', '1.0700']) {
                log(`doing ${pool}, ${cr}`);
                const [readings, outcomes] = await delve(`CR=${cr},liquidate`, [
                    await makeCRTrigger(parseEther(cr)),
                    //makeRollTrigger(1, 'day'),
                    await makeLiquidateTrigger(pool),
                ]);
                //writeReadings(`CR=${cr},${pool}.liquidate`, readings, outcomes);
                writeReadingsDelta(`CR=${cr},${pool}.liquidate`, await readingsDeltas(readings, base), outcomes);
            }

            // const [readings, outcomes] = await delve('drop,liquidate', [
            //     makeTrigger(makeEthPriceTemplate(), parseEther('1400')),
            //     //makeRollTrigger(1, 'day'),
            //     await makeLiquidateTrigger(pool),
            // ]);
            // writeReadings(`ETH=1400,${pool}.liquidate`, readings, outcomes);
            // writeReadingsDelta(`ETH=1400,${pool}.liquidate`, await readingsDeltas(readings, base), outcomes);

            await delvePlot(
                `CR_before_and_after_liquidate-${pool}`,
                {
                    reversed: true,
                    cause: makeTriggerSeries(
                        makeEthPriceTemplate(),
                        parseEther('2000'),
                        parseEther('1100'),
                        parseEther('-20'),
                    ),
                    label: 'ETH v USD price',
                    reader: findReader('MockFxPriceOracle', 'getPrice', '_safePrice'),
                },
                {
                    y: {
                        label: `Collateral ratio`,
                        lines: [
                            {
                                reader: augment(findReader('stETHTreasury', 'collateralRatio'), 'before'),
                                style: 'linetype 1',
                            },
                            {
                                simulation: [await makeLiquidateTrigger(pool)],
                                reader: augment(findReader('stETHTreasury', 'collateralRatio'), 'after'),
                                style: 'linetype 2',
                            },
                        ],
                    },
                },
            );

            await delvePlot(
                `CRxbalance+liquidate-${pool}`,
                {
                    reversed: true,
                    cause: makeTriggerSeries(
                        makeEthPriceTemplate(),
                        parseEther('2000'),
                        parseEther('1100'),
                        parseEther('-20'),
                    ),
                    label: 'Collateral ratio',
                    range: [1.5, 0.9],
                    reader: calculateCR,
                },
                {
                    simulation: [await makeLiquidateTrigger(pool)],
                    y: {
                        label: `Pool balance of fETH/xETH`,
                        // scale: 'log',
                        range: [-10000, '*<50000000'],
                        lines: [
                            {
                                reader: await findReader('fETH', 'balanceOf', '', pool), // RebalancePool, BoostableRebalancePool__wstETHWrapper, BoostableRebalancePool__StETHAndxETHWrapper
                                style: 'linetype 2 linewidth 2 dashtype 2',
                            },
                            {
                                reader: await findReader('xETH', 'balanceOf', '', pool), // BoostableRebalancePool__StETHAndxETHWrapper
                                style: 'linetype 1 linewidth 2 dashtype 2',
                                ignore0: true,
                            },
                            {
                                reader: await findReader('xETH', 'balanceOf', '', wrapper), // BoostableRebalancePool__StETHAndxETHWrapper
                                style: 'linetype 1 linewidth 4 dashtype 3',
                                ignore0: true,
                            },
                        ],
                    },
                    y2: {
                        label: 'Change in balance of (ETH-ish)',
                        lines: [
                            {
                                reader: await findDeltaReader('stETH', 'balanceOf', '', 'stETHTreasury'), // RebalancePool, BoostableRebalancePool__wstETHWrapper, BoostableRebalancePool__StETHAndxETHWrapper
                                style: 'linetype 4 pointtype 1',
                            },
                            {
                                reader: await findDeltaReader('stETH', 'balanceOf', '', 'Market'), // RebalancePool, BoostableRebalancePool__wstETHWrapper, BoostableRebalancePool__StETHAndxETHWrapper
                                style: 'linetype 4 pointtype 2',
                            },
                            {
                                reader: await findDeltaReader('stETH', 'balanceOf', '', wrapper), // RebalancePool, BoostableRebalancePool__wstETHWrapper, BoostableRebalancePool__StETHAndxETHWrapper
                                style: 'linetype 4 pointtype 4',
                            },
                            {
                                reader: await findDeltaReader('stETH', 'balanceOf', '', 'wstETH'), // RebalancePool, BoostableRebalancePool__wstETHWrapper
                                style: 'linetype 4 pointtype 6',
                            },
                            {
                                reader: await findDeltaReader('stETH', 'balanceOf', '', 'PlatformFeeSpliter'), // BoostableRebalancePool__StETHAndxETHWrapper
                                style: 'linetype 4 pointtype 8',
                            },
                            {
                                reader: await findDeltaReader('wstETH', 'balanceOf', '', wrapper), // REbalancePool, BoostableRebalancePool__wstETHWrapper
                                style: 'linetype 6 pointtype 1',
                                ignore0: true,
                            },
                            {
                                reader: await findDeltaReader('wstETH', 'balanceOf', '', pool), // REbalancePool, BoostableRebalancePool__wstETHWrapper
                                style: 'linetype 6 pointtype 2',
                                ignore0: true,
                            },
                            {
                                reader: await findDeltaReader('FXN', 'balanceOf', '', liquidatorContract), // REbalancePool, BoostableRebalancePool__wstETHWrapper
                                style: 'linetype 8 pointtype 1',
                            },
                            {
                                reader: await findDeltaReader('FXN', 'balanceOf', '', users.liquidator.address), // REbalancePool, BoostableRebalancePool__wstETHWrapper
                                style: 'linetype 8 pointtype 2',
                            },
                        ],
                    },
                },
            );
        }
    };
}

const main = async () => {
    // TODO: plot the below against a beta = 0 set up
    // TODO: could do a plot of beta against collateral ratio, would like beta=0 to have the highest, I suspect it doesn't
    // TODO: plot collateral ratio against minted x & f tokens, base the amount on the current collateral stETHTreasury.totalBaseToken

    // TODO: drive a collateral ratio < 130% with eth price. then run a liquidation bot to see what changes
    // beforehand either get a depositor's address, or deposit some from one of my users
    // TODO: when running the liquidator bot, we should get the return values of the liquidate function - see doUserEvent in delve.ts
    // TODO: run a couple of deposits with a reward cycle between them and see the rewards distributed
    // TODO: reserve pool?
    // small price change
    // await delve('2500 price', [{ name: 'ETH', precision: 0, setMarket: setPrice, value: parseEther('2500') }]);

    await eatMain([new EatCollateralRatio()]);
};

// use this pattern to be able to use async/await everywhere and properly handle errors.
withLogging(main)()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
