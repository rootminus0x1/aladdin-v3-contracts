import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
dotenvExpand.expand(dotenv.config());

import { getConfig, write } from 'eat';
import { mermaid } from 'eat';
import { asDateString } from 'eat';
import { setupBlockchain } from 'eat';
import { dig } from 'eat';
import { delve } from 'eat';

async function main() {
    const timestamp = await setupBlockchain(getConfig().block, false);

    // spider across the blockchain, following addresses contained in contracts, until we stop or are told to stop
    // we build up the graph structure as we go for future processing

    await dig();

    // output a diagram
    write('diagram.md', await mermaid(getConfig().block, asDateString(timestamp), getConfig().diagram));

    await delve();
}

// use this pattern to be able to use async/await everywhere and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error: %s', error);
        process.exit(1);
    });
