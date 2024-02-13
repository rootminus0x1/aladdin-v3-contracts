import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { ethers } from 'hardhat';
import { formatEther, parseEther } from 'ethers';
import { mine, setBalance, time } from '@nomicfoundation/hardhat-network-helpers';

import { contracts, deploy, getEthPrice, doEvent, events, marketEvent, Role, parseTime, asDateString } from 'eat';
import { getConfig, setupBlockchain, getSignerAt } from 'eat';
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

    // TODO: some of this initialisation should be done on demand, rather than the existence of a contract
    if (contracts.stETHTreasury && events.harvest) {
        // handle price changes
        const oracle = await deploy<MockFxPriceOracle>('MockFxPriceOracle');
        await contracts.stETHTreasury.connect(contracts.stETHTreasury.ownerSigner).updatePriceOracle(oracle.address);

        events.ETH = {
            name: 'ETH',
            setMarket: async (value: bigint) => {
                await oracle.setPrice(value);
                return value;
            },
        };

        const makeRollEvent = (by: number, units: string) => {
            return {
                name: by.toString + units,
                value: parseTime(by, units),
                setMarket: async (increment: number) => {
                    const target = (await time.latest()) + increment;
                    console.log(`moving time to ${asDateString(target)}...`);
                    await time.increaseTo(target);
                    return target - getConfig().timestamp; // delta time
                },
            };
        };

        events.doLeverageRatio = {
            setMarket: async () => {
                await doEvent(events.harvest); // maybe a less intrusive way to do this
            },
        };
    }
    if (events.ETH && contracts.FractionalToken && contracts.RebalancePool) {
        events.liquidate = {
            name: 'liquidate',
            setMarket: async () => {
                const pools = await contracts.RebalancePoolRegistry.getPools();
                let result = false;
                for (const poolAddress of pools) {
                    // const liquidator = new ethers.Contract(poolAddress, [`function liquidate(uint256) view returns (address)`], whale);
                    const pool = contracts[poolAddress];
                    let liquidatorAddress = undefined;
                    if (pool.roles) {
                        const role = pool.roles.find((r: Role) => r.name === 'LIQUIDATOR_ROLE');
                        if (role) liquidatorAddress = role.addresses[0];
                    }
                    if (!liquidatorAddress && pool.interface.hasFunction('liquidator')) {
                        liquidatorAddress = await pool.liquidator();
                    }
                    if (!liquidatorAddress) throw Error(`couldnot find liquidator for ${pool.name}`);
                    const liquidator = contracts[liquidatorAddress];
                    try {
                        const tx = await liquidator.liquidate(0n);
                        const receipt = await tx.wait();
                        /*
                            const logs = receipt.logs;
                            const abi = poolContract.interface;
                            if (logs && logs.length && abi) {
                                const args = abi.parseLog(logs[0])?.args;
                                amount = args?.returnValue;
                            }
                            */
                        await mine(1, { interval: parseTime(1, 'hour') }); // liquidate and mine before the next liquidate
                        console.log(
                            `liquidated ${pool.name} via ${
                                liquidator.name
                            }, block: ${await time.latestBlock()}, CR: ${await contracts.stETHTreasury.collateralRatio()}`,
                        );
                        result = true;
                    } catch (e: any) {
                        console.log(`error liquidating ${pool.name} via ${liquidator.name}: ${e.message}`);
                    }
                }
                return result;
            },
        };

        // TODO: set the price according to stETHTreasury.getCurrentNav._baseNav
        await doEvent(events.ETH, startEthPrice); // set to the current eth price, like nothing had changed (approx)

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
                'Ether Price (USD)',
                marketEvents(events.ETH, parseEther('3000'), parseEther('10'), parseEther('-50')),
                'collateral ratio',
                [
                    { match: [{ contract: 'stETHTreasury', functions: ['collateralRatio'] }] },
                    {
                        simulation: [events.liquidate],
                        match: [{ contract: 'stETHTreasury', functions: ['collateralRatio'] }],
                    },
                ],
                /*
                'leverage ratio',
                [{ simulation: [events.doLeverageRatio, makeRollEvent(2, "week")], match: [{ contract: 'stETHTreasury', functions: ['leverageRatio'] }] }],
            */
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

            // run a simulation, on base state
            await delve(
                'simulation mint, drop, mint',
                [],
                [events.mintFToken_1000eth, marketEvent(events.ETH, parseEther('1300')), events.mintFToken_1000eth],
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
