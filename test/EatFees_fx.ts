import { IEat, Reading, parseArg, delve, readingsDeltas, users, writeReadingsDelta, doTrigger, log } from 'eat';
import {
    makeCRTrigger,
    makeMintFTokenTrigger,
    makeMintXTokenTrigger,
    makeRedeemFTokenTrigger,
    makeRedeemXTokenTrigger,
} from './triggers_fx';
import { MaxUint256, parseEther } from 'ethers';
import { EatCollateralRatio } from './EatCollateralRatio_fx';

export class EatFees extends EatCollateralRatio implements IEat {
    public name = 'Fees';

    public doStuff = async (base: Reading[]) => {
        // assuming that minting x and f tokens now is possible
        // fill the wallets of x and f minters with a small amount of f and x tokens
        const mintFTokenTrigger = await makeMintFTokenTrigger(parseArg('1 finney'), users.fMinter);
        const mintFOutcome = await doTrigger(mintFTokenTrigger);
        if (mintFOutcome.error) log(`error minting FTokens: ${mintFOutcome.error}`);
        const mintXTokenTrigger = await makeMintXTokenTrigger(parseArg('1 finney'), users.xMinter);
        const mintXOutcome = await doTrigger(mintXTokenTrigger);
        if (mintXOutcome.error) log(`error minting XTokens: ${mintXOutcome.error}`);

        await this.forEachCR('', async (cr: string) => {
            {
                await doTrigger(await makeCRTrigger(parseEther(cr)));
                const [baseAtCR] = await delve(`base,CR=${cr}`);

                const [readings, outcomes] = await delve(`CR=${cr},fees-mintF`, [
                    mintFTokenTrigger,
                    await makeRedeemFTokenTrigger(MaxUint256, users.fMinter),
                    mintXTokenTrigger,
                    await makeRedeemXTokenTrigger(MaxUint256, users.xMinter),
                ]);
                writeReadingsDelta(`CR=${cr},fees`, await readingsDeltas(readings, baseAtCR), outcomes);
            }

            /*await delvePlot(
                `Fees`,
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
            */
        });
    };
}
