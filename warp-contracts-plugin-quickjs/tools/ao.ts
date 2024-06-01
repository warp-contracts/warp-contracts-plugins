import fs from 'fs';
import {Tag, WarpFactory} from 'warp-contracts';
import {ArweaveSigner, createData} from 'warp-arbundles';
import { DeployPlugin } from 'warp-contracts-plugin-deploy';

const jwk = JSON.parse(fs.readFileSync('.secrets/jwk.json', 'utf-8'));
const signer = new ArweaveSigner(jwk);

const warp = WarpFactory.forMainnet().use(new DeployPlugin());

async function main() {
    const args = process.argv;
    const messageType = process.argv[2];
    const processId = process.argv[3];
    const moduleId = process.argv[4]
    // deploy module

    if (messageType == 'module') {
        const module = fs.readFileSync('tools/data/counter.js', 'utf-8');
        const moduleTags = [
            new Tag('Data-Protocol', 'ao'),
            new Tag('Variant', 'ao.TN.1'),
            new Tag('Type', 'Module'),
            new Tag('Module-Format', 'wasm32-unknown-emscripten'),
            new Tag('Input-Encoding', 'JSON-1'),
            new Tag('Output-Encoding', 'JSON-1'),
            new Tag('Memory-Limit', '500-mb'),
            new Tag('Compute-Limit', '9000000000000'),
            new Tag('Salt', '' + Date.now())
        ];
        const srcTx = await warp.createSource({src: module, tags: moduleTags}, signer);
        const srcTxId = await warp.saveSource(srcTx);
        console.log('module', srcTxId);
    }

    // moduleTxId eZtNxRKSV-DctG1FyWLl7oPv3YhEobFqQl4sSMVL1zQ

    // deploy process

    const processTags = [
        new Tag('Data-Protocol', 'ao'),
        new Tag('Variant', 'ao.TN.1'),
        new Tag('Type', 'Process'),
        new Tag('Module', moduleId),
        // new Tag('Module', '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4'),
        // new Tag('Scheduler', '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA'),
        // new Tag('Scheduler', '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA'),
        new Tag('Scheduler', 'jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M'),
        new Tag('SDK', 'ao'),
        new Tag('Content-Type', 'text/plain'),
        new Tag('Name', 'asia')
    ];

    let muAddress = 'https://mu.warp.cc';
    //let muAddress = 'http://localhost:8080';
    if (messageType == 'process') {
        const data = JSON.stringify({counter: {}});
        const processDataItem = createData(data, signer, {tags: processTags});
        await processDataItem.sign(signer);

        const processResponse = await fetch(muAddress, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                Accept: 'application/json'
            },
            body: processDataItem.getRaw()
        }).then((res) => res.json());

        console.log('process', processResponse);

        // process id: EdlYmP5v-3YFiQrqI9kTU62XFKiIFlFWTS-_s0ylX2Q

        // const response = await fetch(
        //   `http://su66.ao-testnet.xyz:9000/processes/${processResponse.id}`
        // ).then((res) => res.json());

        // console.log(response);
    }

    if (messageType == 'message') {
        const messageTags = [
            new Tag('Action', 'increment'),
            new Tag('Data-Protocol', 'ao'),
            new Tag('Type', 'Message'),
            new Tag('Variant', 'ao.TN.1'),
            {name: 'SDK', value: 'ao'},
            // new Tag('From-Process', 'KyAIk7duSYro_RzURr3Tq61Q7UN9IEs__B7tui0vzwE'),
            new Tag('From-Process', processId),
            new Tag('From-Module', moduleId),
            new Tag('Salt', '' + Date.now())
            // new Tag('From-Module', '9afQ1PLf2mrshqCTZEzzJTR2gWaC9zNPnYgYEqg1Pt4')
        ];

        const messageDataItem = createData('1234', signer, {
            tags: messageTags,
            target: processId
        });
        await messageDataItem.sign(signer);

        const messageResponse = await fetch(muAddress, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                Accept: 'application/json'
            },
            body: messageDataItem.getRaw()
        }).then((res) => res.json());

        console.log('message', messageResponse);
    }

    // // message id: Co3RbzBP-E-66s2LsZlrWjDdciI8-9bMuFAsnsYI1jU
}

main()
    .catch((e) => console.error(e))
    .finally();