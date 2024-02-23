import {
  ContractInteractionState,
  ContractType,
  DEFAULT_LEVEL_DB_LOCATION,
  DefaultEvaluationOptions,
  EvalStateResult,
  ExecutionContext,
  LevelDbCache,
  LoggerFactory,
  SmartWeaveGlobal,
  WarpFactory
} from 'warp-contracts';
import { QuickJsPlugin } from '../src';
import fs from 'fs';
import Arweave from 'arweave';
import { expect, test } from 'vitest';

LoggerFactory.INST.logLevel('error');

const contractSource = fs.readFileSync('tests/data/counter.js', 'utf-8');
const quickJSPlugin = new QuickJsPlugin({});
const arweave = Arweave.init({});
const warp = WarpFactory.forLocal();
const db = new LevelDbCache({
  inMemory: false,
  dbLocation: DEFAULT_LEVEL_DB_LOCATION
});

const contractDefinition = {
  txId: '1234',
  srcTxId: '5678',
  src: contractSource,
  initState: {},
  owner: 'owner',
  contractType: 'js' as ContractType,
  srcBinary: null,
  srcWasmLang: null,
  minFee: '',
  contractTx: {
    format: null,
    id: '1234',
    last_tx: '910',
    owner: 'owner',
    tags: [],
    target: null,
    quantity: 0,
    data: 'data',
    data_size: 50,
    data_root: null,
    data_tree: null,
    reward: null,
    signature: 'signature'
  },
  srcTx: {
    format: null,
    id: '1234',
    last_tx: '910',
    owner: 'owner',
    tags: [],
    target: null,
    quantity: 0,
    data: 'data',
    data_size: 50,
    data_root: null,
    data_tree: null,
    reward: null,
    signature: 'signature'
  },
  testnet: null
};

const executionContext: ExecutionContext<unknown, unknown> = {
  warp,
  contract: warp.contract('1234'),
  contractDefinition,
  sortedInteractions: [],
  evaluationOptions: new DefaultEvaluationOptions()
};

const swGlobal = new SmartWeaveGlobal(
  arweave,
  {
    id: '1234',
    owner: 'owner'
  },
  new DefaultEvaluationOptions(),
  new ContractInteractionState(WarpFactory.forLocal()),
  db
);

let wasmMemory: Buffer;

test('should return WASM memory in result', async () => {
  const quickJs = await quickJSPlugin.process({
    contractSource,
    evaluationOptions: new DefaultEvaluationOptions(),
    swGlobal,
    contractDefinition
  });

  const result = await quickJs.handle(executionContext, new EvalStateResult<unknown>({}, {}, {}), {
    interaction: {
      input: {
        function: 'increment'
      },
      caller: '1234',
      interactionType: 'write'
    },
    interactionTx: {
      id: '1234',
      anchor: '',
      signature: 'signature',
      recipient: 'recipient',
      owner: {
        address: 'owner',
        key: 'key'
      },
      fee: {
        ar: '',
        winston: ''
      },
      quantity: {
        ar: '',
        winston: ''
      },
      data: {
        size: 10,
        type: ''
      },
      tags: [],
      block: {
        id: '1234',
        timestamp: 1234,
        height: 1234,
        previous: '123'
      },
      parent: {
        id: '1234'
      },
      bundledIn: {
        id: '123'
      }
    }
  });

  wasmMemory = result.Memory;
  // fs.writeFileSync('test.dat', result.Memory);
  expect(Buffer.from(result.Memory.buffer).length).toEqual(16777254);
});

test('should create new VM with WASM memory from the previous calculation', async () => {
  const quickJs2 = await quickJSPlugin.process({
    contractSource,
    evaluationOptions: new DefaultEvaluationOptions(),
    swGlobal,
    contractDefinition,
    wasmMemory
  });

  const result2 = await quickJs2.handle(executionContext, new EvalStateResult<unknown>({}, {}, {}), {
    interaction: {
      input: {
        function: 'increment'
      },
      caller: '1234',
      interactionType: 'write'
    },
    interactionTx: {
      id: '12345',
      anchor: '',
      signature: 'signature',
      recipient: 'recipient',
      owner: {
        address: 'owner',
        key: 'key'
      },
      fee: {
        ar: '',
        winston: ''
      },
      quantity: {
        ar: '',
        winston: ''
      },
      data: {
        size: 10,
        type: ''
      },
      tags: [],
      block: {
        id: '12345',
        timestamp: 12345,
        height: 1235,
        previous: '1234'
      },
      parent: {
        id: '1234'
      },
      bundledIn: {
        id: '123'
      }
    }
  });
  console.dir(result2, { depth: null });
  expect(result2.state.counter).toBeDefined();
});
