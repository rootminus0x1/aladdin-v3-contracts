import { MockFxPriceOracle } from '@types';
import {
    IEat,
    Reading,
    augment,
    contracts,
    delve,
    delvePlot,
    deploy,
    findDeltaReader,
    findReader,
    log,
    makeTriggerSeries,
    readingsDeltas,
    users,
    writeReadingsDelta,
} from 'eat';
import { makeCRTrigger, makeEthPriceTemplate, makeLiquidateTrigger } from './triggers';
import { parseEther } from 'ethers';
import { calculateCR } from './readers';

export class EatCollateralRatio implements IEat {
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

    public forEachCR = async (info: string, f: (cr: string) => Promise<void>) => {
        // currently ratios are (from etherscan):
        //stabilityRatio   uint64 :  1305500000000000000
        //liquidationRatio   uint64 :  1206700000000000000
        //selfLiquidationRatio   uint64 :  1143900000000000000
        //recapRatio   uint64 :  1000000000000000000
        //                      1.3055    1.2067    1.1439    1.0000
        for (const cr of ['1.3100', '1.2500', '1.1700', '1.0700']) {
            log(`doing ${info} CR=${cr}`);
            await f(cr);
        }
    };

    public doStuff = async (base: Reading[]) => {
        // above and below the 130% CR
        for (const [pool, wrapper, liquidatorContract] of [
            ['RebalancePool', 'wstETHWrapper', 'RebalanceWithBonusToken__0'],
            ['BoostableRebalancePool__wstETHWrapper', 'wstETHWrapper', 'RebalanceWithBonusToken__1'],
            ['BoostableRebalancePool__StETHAndxETHWrapper', 'StETHAndxETHWrapper', 'RebalanceWithBonusToken__2'],
        ]) {
            await this.forEachCR(pool, async (cr: string) => {
                const [readings, outcomes] = await delve(`CR=${cr},liquidate`, [
                    await makeCRTrigger(parseEther(cr)),
                    //makeRollTrigger(1, 'day'),
                    await makeLiquidateTrigger(pool),
                ]);
                //writeReadings(`CR=${cr},${pool}.liquidate`, readings, outcomes);
                writeReadingsDelta(`CR=${cr},${pool}.liquidate`, await readingsDeltas(readings, base), outcomes);

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
            });
        }
    };
}
