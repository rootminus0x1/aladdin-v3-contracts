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
    triggers,
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
    parseArg,
    addTokenToWhale,
    whale,
    makeReader,
    doReading,
    readingsDeltas,
    withLogging,
    writeDiagram,
    writeReadingsDelta,
} from 'eat';
import { getConfig, setupBlockchain, getSignerAt } from 'eat';
import { dig } from 'eat';
import { delve } from 'eat';

import { MockFxPriceOracle } from '@types';

async function main() {
    await setupBlockchain();
    const startEthPrice = await getEthPrice(getConfig().timestamp);

    // TODO: scan event logs for events like UpdateSettleWhitelist(_account, _status)
    // the description of what parameters to gleem and how they are presented (array of addresses)
    // to the diagram - I think this is just another reading - does etherscan have events?

    await dig('base');
    // TODO: wrap this into a config.writeDaigram('base'); which would write .mmd & .md
    if (getConfig().diagram) writeDiagram('base', await mermaid());

    const baseNav = (await contracts.stETHTreasury.getCurrentNav())._baseNav;
    //console.log(`price=${formatEther(startEthPrice)}, baseNav=${formatEther(baseNav)}`);

    const [base] = await delve('base'); // get the base readings for comparisons
    writeReadings('base', base);

    // add the mock price contract
    const mock = await deploy<MockFxPriceOracle>('MockFxPriceOracle');
    await contracts.stETHTreasury
        .connect(contracts.stETHTreasury.ownerSigner)
        .updatePriceOracle(contracts.MockFxPriceOracle.address);
    // TODO: create a difference between a trigger (no parameters needed) and a trigger template (need to supply parameters)
    triggers.ETH = {
        // this is a trigger template
        name: 'ETH',
        pull: async (value: bigint) => {
            return await contracts.MockFxPriceOracle.setPrice(value);
        },
    };

    /*
    const setPrice = await doTrigger(triggers.ETH, baseNav); // set to the current eth price, like nothing had changed (approx)
    {
        // check contract calling
        const checkBaseNav = (await contracts.stETHTreasury.getCurrentNav())._baseNav;
        if (checkBaseNav != baseNav) console.log('error in baseNav');
        // check triggers and readers
        await doTrigger(triggers.ETH, startEthPrice / 2n); // half te price
        if (startEthPrice / 2n != (await doReading(contracts.stETHTreasury.address, 'getCurrentNav', '_baseNav')).value)
            console.log('error in trigger and/or reader');
    }
   */
    const outcome = await doTrigger(triggers.ETH, baseNav);
    // redig
    await dig('mockETH');
    if (getConfig().diagram) writeDiagram('mockETH', await mermaid());

    const [mockETH] = await delve('mockETH'); // get the base readings for comparisons
    writeReadings('mockETH', mockETH);
    writeReadingsDelta('mockETH', await readingsDeltas(mockETH, base), [outcome]);

    const makeRollTrigger = (by: number, units: string): Trigger => {
        return {
            name: by.toString + units,
            args: [BigInt(parseTime(by, units))],
            pull: async (increment: number) => {
                const target = (await time.latest()) + increment;
                console.log(`moving time to ${asDateString(target)}...`);
                await time.increaseTo(target);
                return target - getConfig().timestamp; // delta time
            },
        };
    };

    triggers.doLeverageRatio = {
        setMarket: async () => {
            await doTrigger(triggers.harvest); // maybe a less intrusive way to do this
        },
    };
    //}
    //if (events.ETH && contracts.FractionalToken && contracts.RebalancePool) {
    const makeLiquidateEvent = async (poolIndex: number): Promise<Trigger> => {
        const pools = await contracts.RebalancePoolRegistry.getPools();
        const poolAddress = pools[poolIndex];
        const pool = contracts[poolAddress];
        const wrapperAddress = await pool.wrapper();
        const wrapper = contracts[wrapperAddress];
        const poolName = `${pool.name}(${wrapper.name})`;
        return {
            name: `${poolName}.liquidate`,
            pull: async () => {
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
                const tx = await liquidator.liquidate(0n);
                const receipt = await tx.wait();
                // console.log(`liquidate on ${pool.name} ${pool.address} via ${liquidator.name}`);

                // TODO: extract the last event and extract the content
                const events = receipt.logs
                    .map((log: any) => pool.interface.parseLog(log))
                    .filter((event: any) => event !== null);
                await mine(1, { interval: parseTime(1, 'hour') }); // liquidate and mine before the next liquidate
                // event Liquidate(uint256 liquidated, uint256 baseGained);
                return { liquidated: formatEther(events[0].args[0]), baseGained: formatEther(events[0].args[1]) };
            },
        };
    };

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
    /*
    for (const [index, pool] of ['RebalancePool', 'BoostableRebalancePool__0', 'BoostableRebalancePool__1'].entries()) {
        await delvePlot(
            `CR+balanceOfxETH(${pool})`,
            'Ether Price (USD)',
            marketEvents(events.ETH, parseEther('2400'), parseEther('1000'), parseEther('-20')),
            ['collateral ratio', `FractionalToken.balanceOf(${pool})`],
            [
                {
                    calculations: [
                        {
                            match: { contract: 'stETHTreasury', reading: 'collateralRatio' },
                            lineStyle: 'linetype 8 linewidth 3 dashtype 3',
                        },
                    ],
                },
                {
                    simulation: [await makeLiquidateEvent(index)],
                    calculations: [
                        {
                            match: { contract: 'stETHTreasury', reading: 'collateralRatio' },
                            lineStyle: 'linetype 1',
                        },
                        {
                            match: {
                                contract: 'FractionalToken',
                                reading: 'balanceOf',
                                target: contracts[pool].address,
                            },
                            lineStyle: 'linetype 2',
                            y2axis: true,
                        },
                    ],
                },

                    {
                        simulation: [await makeLiquidateEvent(1)],
                        calculations: [
                            {
                                match: { contract: 'stETHTreasury', reading: 'collateralRatio' },
                                lineStyle: 'linetype 2',
                            },
                            {
                                match: {
                                    contract: 'FractionalToken',
                                    reading: 'balanceOf',
                                    target: contracts['BoostableRebalancePool__0'].address,
                                },
                                lineStyle: 'linetype 2 linewidth 2 dashtype 2',
                                y2axis: true,
                            },
                        ],
                    },
                    {
                        simulation: [await makeLiquidateEvent(2)],
                        calculations: [
                            {
                                match: { contract: 'stETHTreasury', reading: 'collateralRatio' },
                                lineStyle: 'linetype 4',
                            },
                            {
                                match: {
                                    contract: 'FractionalToken',
                                    reading: 'balanceOf',
                                    target: contracts['BoostableRebalancePool__1'].address,
                                },
                                lineStyle: 'linetype 4 linewidth 2 dashtype 2',
                                y2axis: true,
                            },
                        ],
                    },

            ],

                'leverage ratio',
                [{ simulation: [events.doLeverageRatio, makeRollEvent(2, "week")], match: [{ contract: 'stETHTreasury', functions: ['leverageRatio'] }] }],

        );
    }
    */

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
    const [r, s] = await delve('drop,liquidate', [
        makeTrigger(triggers.ETH, parseEther('1600')),
        makeRollTrigger(1, 'day'),
        await makeLiquidateEvent(0),
    ]);
    writeReadings('drop,liquidate', r, s);
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
withLogging(main)()
    .then(() => process.exit(0))
    .catch((error: any) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
