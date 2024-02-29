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
} from 'eat';
import { getConfig, setupBlockchain, getSignerAt } from 'eat';
import { dig } from 'eat';
import { delve } from 'eat';

import { MockFxPriceOracle, StETHTreasury__factory } from '@types';

// TODO: take a snapshot here
const goBase = async (): Promise<Reading[]> => {
    //const startEthPrice = await getEthPrice(getConfig().timestamp);

    await dig('base');
    writeDiagram('base', await mermaid());
    const baseNav = (await contracts.stETHTreasury.getCurrentNav())._baseNav;
    // const [base] = await delve('base'); // get the base readings for comparisons
    /// writeReadings('base', base);

    //log(`${(await callReader(findReader('stETHTreasury', 'collateralRatio'))).value}`);
    //log(`${(await callReader(findReader('stETH', 'balanceOf', '', 'stETHTreasury'))).value}`);
    //log(`${(await callReader(findReader('fETH', 'totalSupply'))).value}`);

    // add the mock price contract
    await deploy<MockFxPriceOracle>('MockFxPriceOracle');
    await contracts.stETHTreasury
        .connect(contracts.stETHTreasury.ownerSigner)
        .updatePriceOracle(contracts.MockFxPriceOracle.address);

    // redig
    await dig('mockETH');
    await digUsers(); // add the users (also on the graph)
    writeDiagram('mockETH', await mermaid());

    findReader('MockFxPriceOracle', 'getPrice', '_safePrice');

    const tx = await contracts.MockFxPriceOracle.setPrice(baseNav);
    const [mockETH] = await delve('mockETH'); // get the base readings for comparisons
    writeReadings('mockETH', mockETH);
    // writeReadingsDelta('mockETH', await readingsDeltas(mockETH, base), []);

    return mockETH;
};

async function main() {
    await setupBlockchain();

    const base = await goBase();

    // TODO: scan event logs for events like UpdateSettleWhitelist(_account, _status)
    // the description of what parameters to gleem and how they are presented (array of addresses)
    // to the diagram - I think this is just another reading - does etherscan have events?

    // TODO: create a difference between a trigger (no parameters needed) and a trigger template (need to supply parameters)

    const makeEthTemplate = (): TriggerTemplate => {
        return {
            name: 'ETH',
            argTypes: ['uint256'],
            pull: async (value: bigint) => {
                const tx = await contracts.MockFxPriceOracle.setPrice(value);
                return tx;
            },
        };
    };

    const calculateCR = makeCalculator('CR', async () => {
        //=COLLATERAL_VALUE_USD/(FTOKEN_SUPPLY*FTOKEN_PRICE_USD)
        const precision = 10n ** 18n;
        const collatStETH: bigint = await contracts.stETHTreasury.totalBaseToken();
        const navs = await contracts.stETHTreasury.getCurrentNav();
        const collatUSD = (collatStETH * BigInt(navs._baseNav)) / precision;
        const fTokenSupply: bigint = await contracts.fETH.totalSupply();
        const fTokenUSD = (fTokenSupply * BigInt(navs._fNav)) / precision;
        return (collatUSD * precision) / fTokenUSD;
    });

    const makeRollTrigger = (by: number, units: string): Trigger => {
        return {
            name: `roll(${by.toString()}${units})`,
            args: [parseTime(by, units)],
            argTypes: ['unit256'],
            pull: async (increment: number) => {
                //log('rolling...');
                const target = (await time.latest()) + increment;
                //log(`rolling time to ${asDateString(target)}...`);
                await time.increaseTo(target);
                return undefined;
            },
        };
    };

    const makeHarvestTrigger = () => {
        return {
            name: `harvest`,
            args: [],
            argTypes: [],
            pull: async () => {
                return await contracts.stETHTreasury.harvest();
            },
        };
    };

    //}
    //if (events.ETH && contracts.fETH && contracts.RebalancePool) {
    const makeLiquidateTrigger = async (contractName: string): Promise<Trigger> => {
        //const pools = await contracts.RebalancePoolRegistry.getPools();
        //const poolAddress = pools[poolIndex];
        const pool = contracts[contractName].address;
        return {
            name: `liquidate ${contractName}`,
            argTypes: ['address'],
            args: [pool],
            pull: async (poolAddress: string) => {
                const pool = contracts[poolAddress];
                let liquidatorAddress = undefined;
                if (pool.roles) {
                    const role = pool.roles.find((r: Role) => r.name === 'LIQUIDATOR_ROLE');
                    if (role) liquidatorAddress = role.addresses[0];
                }
                if (!liquidatorAddress && pool.interface.hasFunction('liquidator')) {
                    liquidatorAddress = await pool.liquidator();
                }
                if (!liquidatorAddress) throw Error(`could not find liquidator for ${pool.name}`);
                const liquidator = contracts[liquidatorAddress];
                const tx = await liquidator.connect(users.liquidator).liquidate(0n); // no minimum

                // await mine(1, { interval: parseTime(1, 'hour') }); // liquidate and mine before the next liquidate

                return tx;
            },
        };
    };

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
                        async () => await contracts.stETHTreasury.collateralRatio(),
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
    /*
            // run a simulation, on base state
            await delve(
                'simulation mint, drop, mint',
                [],
                [events.mintFToken_1000eth, marketEvent(events.ETH, parseEther('1300')), events.mintFToken_1000eth],
            );
            */
    /*
    await delvePlot(
        'ETHxCR',
        {
            cause: makeTriggerSeries(makeEthTemplate(), parseEther('2400'), parseEther('1000'), parseEther('-20')),
            label: 'Ether Price (USD)',
            reversed: true,
            reader: findReader('MockFxPriceOracle', 'getPrice', '_safePrice'),
        },
        {
            simulation: [makeHarvestTrigger(), makeRollTrigger(30, 'day')],
            y: {
                label: 'Collateral ratio',
                lines: [{ reader: findReader('stETHTreasury', 'collateralRatio') }],
            },
            y2: {
                label: 'Leverage ratio',
                lines: [{ reader: findReader('stETHTreasury', 'leverageRatio') }],
            },
        },
    );
        */
    for (const [pool, wrapper, liquidatorContract] of [
        ['RebalancePool', 'wstETHWrapper', 'RebalanceWithBonusToken__0'],
        ['BoostableRebalancePool__wstETHWrapper', 'wstETHWrapper', 'RebalanceWithBonusToken__1'],
        ['BoostableRebalancePool__StETHAndxETHWrapper', 'StETHAndxETHWrapper', 'RebalanceWithBonusToken__2'],
    ]) {
        const [readings, outcomes] = await delve('drop,liquidate', [
            makeTrigger(makeEthTemplate(), parseEther('1400')),
            //makeRollTrigger(1, 'day'),
            await makeLiquidateTrigger(pool),
        ]);
        writeReadings(`ETH=1400,${pool}.liquidate`, readings, outcomes);
        writeReadingsDelta(`ETH=1400,${pool}.liquidate`, await readingsDeltas(readings, base), outcomes);

        await delvePlot(
            `CR_before_and_after_liquidate-${pool}`,
            {
                reversed: true,
                cause: makeTriggerSeries(makeEthTemplate(), parseEther('2000'), parseEther('1100'), parseEther('-20')),
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
                cause: makeTriggerSeries(makeEthTemplate(), parseEther('2000'), parseEther('1100'), parseEther('-20')),
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
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
withLogging(main)()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
