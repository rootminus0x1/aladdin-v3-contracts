import { IEat, Reading, parseArg, delve, readingsDeltas, users, writeReadingsDelta } from 'eat';
import { makeCRTrigger, makeMintFTokenTrigger } from './triggers';
import { parseEther } from 'ethers';
import { EatCollateralRatio } from './EatCollateralRatio';

export class EatFees extends EatCollateralRatio implements IEat {
    public name = 'Fees';

    public doStuff = async (base: Reading[]) => {
        await this.forEachCR('', async (cr: string) => {
            const [readings, outcomes] = await delve(`CR=${cr},fees-mintF`, [
                await makeCRTrigger(parseEther(cr)),
                await makeMintFTokenTrigger(parseArg('1 finney'), users.fMinter),
            ]);
            writeReadingsDelta(`CR=${cr},fees-mintF`, await readingsDeltas(readings, base), outcomes);

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
