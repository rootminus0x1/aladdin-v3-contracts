import { IEat, Reading, parseArg, delve, readingsDeltas, users, writeReadingsDelta } from 'eat';
import {
    makeCRTrigger,
    makeMintFTokenTrigger,
    makeMintXTokenTrigger,
    makeRedeemFTokenTrigger,
    makeRedeemXTokenTrigger,
} from './triggers';
import { MaxUint256, parseEther } from 'ethers';
import { EatCollateralRatio } from './EatCollateralRatio';

export class EatFees extends EatCollateralRatio implements IEat {
    public name = 'Fees';

    public doStuff = async (base: Reading[]) => {
        await this.forEachCR('', async (cr: string) => {
            {
                const [baseAtCR] = await delve(`base,CR=${cr}`);
                const [readings, outcomes] = await delve(`CR=${cr},fees-mintF`, [
                    await makeCRTrigger(parseEther(cr)),
                    await makeMintFTokenTrigger(parseArg('1 finney'), users.fMinter),
                    await makeRedeemFTokenTrigger(MaxUint256, users.fMinter),
                    await makeMintXTokenTrigger(parseArg('1 finney'), users.xMinter),
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
