import { time } from '@nomicfoundation/hardhat-network-helpers';
import { MaxUint256, formatEther, parseEther } from 'ethers';
import { Role, Trigger, TriggerTemplate, contracts, formatBigInt, inverse, makeTrigger, parseTime, users } from 'eat';
import { nameToAddress } from 'eat';
import { log } from 'console';

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
            async () => await contracts.WrappedTokenTreasuryV2__wstETH_fstETH_xstETH.collateralRatio(),
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
            return await contracts.WrappedTokenTreasuryV2__wstETH_fstETH_xstETH.harvest();
        },
    };
};

export const makeMintFTokenTrigger = (amountInEth: bigint, user: any) => {
    // log(`set up mintingF ${formatBigInt(amountInEth, "ether")} by ${user.name} ${user.address}`);
    return {
        name: `mintFToken`,
        args: [amountInEth],
        argTypes: ['uint256'],
        pull: async (amountInEth: bigint) => {
            return await contracts.MarketV2__wstETH_fstETH_xstETH.connect(user).mintFToken(
                amountInEth,
                user.address,
                0n,
            );
        },
    };
};

export const makeRedeemFTokenTrigger = (amount: bigint, user: any) => {
    // log(`set up mintingF ${formatBigInt(amount, "ether")} by ${user.name} ${user.address}`);
    return {
        name: `redeemFToken`,
        args: [amount],
        argTypes: ['uint256'],
        pull: async (amount: bigint) => {
            return await contracts.MarketV2__wstETH_fstETH_xstETH.connect(user).redeem(amount, 0n, user.address, 0n);
        },
    };
};

export const makeMintXTokenTrigger = (amountInEth: bigint, user: any) => {
    //log(`set up mintingF ${formatBigInt(amountInEth, "ether")} by ${user.name} ${user.address}`);
    return {
        name: `mintXToken`,
        args: [amountInEth],
        argTypes: ['uint256'],
        pull: async (amountInEth: bigint) => {
            return await contracts.MarketV2__wstETH_fstETH_xstETH.connect(user).mintXToken(
                amountInEth,
                user.address,
                0n,
            );
        },
    };
};

export const makeRedeemXTokenTrigger = (amount: bigint, user: any) => {
    //log(`set up mintingF ${formatBigInt(amount, "ether")} by ${user.name} ${user.address}`);
    return {
        name: `redeemXToken`,
        args: [amount],
        argTypes: ['uint256'],
        pull: async (amount: bigint) => {
            return await contracts.MarketV2__wstETH_fstETH_xstETH.connect(user).redeem(0n, amount, user.address, 0n);
        },
    };
};

export const makeLiquidateTrigger = async (contractName: string): Promise<Trigger> => {
    const poolAddress = contracts[contractName].address;
    return {
        name: `liquidate ${contractName}`,
        argTypes: ['address'],
        args: [poolAddress],
        pull: async (poolAddress: string) => {
            const tx = await contracts.FxUSDRebalancer.connect(users.liquidator).liquidate(poolAddress, 0n); // no minimum

            // await mine(1, { interval: parseTime(1, 'hour') }); // liquidate and mine before the next liquidate

            return tx;
        },
    };
};
