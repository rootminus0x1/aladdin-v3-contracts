import { contracts, makeCalculator } from 'eat';

export const calculateCR = makeCalculator('CR', async () => {
    //=COLLATERAL_VALUE_USD/(FTOKEN_SUPPLY*FTOKEN_PRICE_USD)
    const precision = 10n ** 18n;
    const collatStETH: bigint = await contracts.stETHTreasury.totalBaseToken();
    const navs = await contracts.stETHTreasury.getCurrentNav();
    const collatUSD = (collatStETH * BigInt(navs._baseNav)) / precision;
    const fTokenSupply: bigint = await contracts.fETH.totalSupply();
    const fTokenUSD = (fTokenSupply * BigInt(navs._fNav)) / precision;
    return (collatUSD * precision) / fTokenUSD;
});
