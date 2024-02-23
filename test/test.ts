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
