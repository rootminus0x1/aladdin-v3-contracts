import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { ContractWithAddress, contracts, delvePlot, deploy, getConfig, getSigner, writeEatFile } from 'eat';
import { mermaid } from 'eat';
import { asDateString } from 'eat';
import { setupBlockchain } from 'eat';
import { dig } from 'eat';
import { delve } from 'eat';

import { MockFxPriceOracle } from '@types';
import { ethers } from 'hardhat';
import { formatEther, parseEther } from 'ethers';

async function main() {
    // TODO: replace with a simple initialise function and add timestamp to config, etc
    await setupBlockchain();

    await dig();
    await delve(); // no price change

    // mock the price oracle
    // TODO: hide deployer (make a global like whale, or maybe use whale?)
    const deployer = await getSigner('deployer');
    let oracle: ContractWithAddress<MockFxPriceOracle>;
    oracle = await deploy<MockFxPriceOracle>('MockFxPriceOracle', deployer);

    await contracts.stETHTreasury.connect(contracts.stETHTreasury.ownerSigner).updatePriceOracle(oracle.address);

    // TODO: handle multiple variables?

    //const prices = Array.from({ length: 40 }, (_, index) => 4000 - index * 50);

    // TODO: generalise this to take a function to set the new value
    class PriceIterator {
        private initial: number;
        private done = false;
        public value: string = '';

        constructor(public name: string, private price: number, private finish?: number, private step: number = 1) {
            this.initial = price;
        }

        private setPrice = async () => {
            this.value = this.price.toString();
            await oracle.setPrice(parseEther(this.value));
        };

        public next = async () => {
            if (this.finish) {
                // sequence
                if (this.price < this.finish) {
                    return undefined;
                } else {
                    await this.setPrice();
                    this.price -= this.step;
                    return this.value;
                }
            } else {
                // single value
                if (!this.done) {
                    this.setPrice();
                }
            }
        };

        public reset = () => {
            this.price = this.initial;
            this.done = false;
        };
    }

    if (getConfig().plot) {
        await delvePlot(new PriceIterator('ETH', 4000, 1010, 50), [
            { contract: 'stETHTreasury', functions: ['collateralRatio', 'leverageRatio'] },
        ]);
    } else {
        await delve(new PriceIterator('ETH', 2500)); // price change
    }
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
