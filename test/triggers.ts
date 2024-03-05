import { time } from '@nomicfoundation/hardhat-network-helpers';
import { parseEther } from 'ethers';
import { Role, Trigger, TriggerTemplate, contracts, inverse, makeCalculator, makeTrigger, parseTime, users } from 'eat';

export const makeEthPriceTemplate = (): TriggerTemplate => {
    return {
        name: 'ETH',
        argTypes: ['uint256'],
        pull: async (value: bigint) => {
            const tx = await contracts.MockFxPriceOracle.setPrice(value);
            return tx;
        },
    };
};

export const makeCRTrigger = async (cr: bigint) => {
    return makeTrigger(
        makeEthPriceTemplate(),
        await inverse(
            cr,
            async () => await contracts.stETHTreasury.collateralRatio(),
            async (x: bigint) => await contracts.MockFxPriceOracle.setPrice(x),
            [parseEther('1030'), parseEther('10000')],
        ),
    );
};

export const makeRollTrigger = (by: number, units: string): Trigger => {
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

export const makeHarvestTrigger = () => {
    return {
        name: `harvest`,
        args: [],
        argTypes: [],
        pull: async () => {
            return await contracts.stETHTreasury.harvest();
        },
    };
};

export const makeLiquidateTrigger = async (contractName: string): Promise<Trigger> => {
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
