import { LoggerFactory, QuickJsPluginMessage } from 'warp-contracts';
import { QuickJsPlugin } from '../src';
import fs from 'fs';
import { expect, test, describe, beforeAll } from 'vitest';
import { QuickJsHandlerApi } from '../src/QuickJsHandlerApi';
import { DEBUG_SYNC } from 'quickjs-emscripten';
import { joinBuffers } from '../src/utils';

describe('Memory loading test', () => {
  let contractSource: string;
  let quickJSPlugin: QuickJsPlugin<unknown>;
  let message: QuickJsPluginMessage;
  let wasmMemory: Buffer;
  let quickJs: QuickJsHandlerApi<unknown>;

  beforeAll(async () => {
    LoggerFactory.INST.logLevel('error');

    contractSource = fs.readFileSync('tests/data/counter.js', 'utf-8');
    quickJSPlugin = new QuickJsPlugin({});

    message = {
      cron: false,
      data: 'Hello ao',
      epoch: 0,
      from: 'jliaItK34geaPuyOYVqh8fsRgXIXWwa9iLJszGXKOHE',
      id: '1Jy99GiGQryL9MzdgYe4KyQ5UmdRWTMJfGXc7vxEZ-0',
      nonce: 1,
      owner: 'jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M',
      signature:
        'ClPGScgzfNjKUpBM8BxIr2MPlGsVtHMxxQBvs7k9nRAzUlnTQmkcqSmDJk1GA0iQcDHD3-DWXIkWYXUuPwWqYKQOletl5n4FdOTg6xWeXqYd-mpeHPPzpaadhsWs_XCzEt6QSAaRVg1HR79fhIJxCzbWAftwCSMzI-pzQ6HAgCjyy-QFIPthd8UGShnBg0qEmBIvZTOhUK6f6S7cDbphWnb_vLmatNTSAp3iDdTbIewjwFytmFonDn_Er0GYlJ1jGVWfBfjORtPNPsQR-yBqN54HUPTnJ86YzGI3uFTl43Y5E0bGpwLgH78Sz1Db8bziAduXLSVcaPhrYDAmTa7VyiCjAOM3Z1I3ih_BSPUph4GE5BV0JSfSWGvf5Sh2-5E5vkiXjytcY82BGMqbFza6Q1A-ak_btT80eDDbbRdjGjZbulAhHJNYP0DLI-WT0pbxMeOIcMbnVWDbpNvjyM94oQw6IOh706U7rKlf5hz4aadzr9vi1jbSVRJS3Gs58533ax2r-EV1b_22KIgR_aGZcMfIyRuYCE3mUvKOuTjOaN8HmjUnX6YRjJxMWt12QWbTILcyDc_r9Eu3h3z_wZAD3dPAiSu74TS5ErZ_Eyfb3DN32wT-KqQIFS0bzXICi-e4hC-G_v_KPLLeX6sP_kB1n141iGgUj0kyunh2_Mnfs_4',
      tags: {
        type: 'Message',
        variant: 'ao.TN.1',
        'Data-Protocol': 'ao',
        'From-Module': 'PR72afhcby-x9c9Jg--utxw9L8_ZCOyjCgnUhp2JSMA',
        'From-Process': 'jliaItK34geaPuyOYVqh8fsRgXIXWwa9iLJszGXKOHE',
        Action: 'increment'
      },
      target: '',
      timestamp: '1708592722',
      'Block-Height': '1369091',
      'Forwarded-By': 'z1pq2WzmaYnfDwvEFgUZBj48anUsxxN64ZjbWOsIn08',
      'Hash-Chain': 'hJ0B-0yxKxeL3IIfaIIF7Yr6bFLG2vQayaF8G0EpjbY'
    };

    quickJs = await quickJSPlugin.process({
      contractSource
    });
  });

  test('should correctly handle message', async () => {
    const result = await quickJs.handle(message);
    expect(result.Messages[0].tags.find((t: { name: string; value: string }) => t.name == 'counter').value).toEqual(1);
  });

  test('should return WASM memory in result', async () => {
    const quickJs = await quickJSPlugin.process({
      contractSource
    });

    const result = await quickJs.handle(message);

    wasmMemory = result.Memory;

    expect(Buffer.from(result.Memory.buffer).length).toEqual(16777254);
  });

  test('should create new VM with WASM memory from the previous calculation', async () => {
    const quickJs2 = await quickJSPlugin.process({
      contractSource,
      wasmMemory
    });

    const result2 = await quickJs2.handle(message);
    expect(result2.Messages[1].tags.find((t: { name: string; value: string }) => t.name == 'counter').value).toEqual(2);

    wasmMemory = result2.Memory;
  });

  test('should correctly handle ProcessError', async () => {
    const quickJs3 = await quickJSPlugin.process({
      contractSource,
      wasmMemory
    });

    const result3 = await quickJs3.handle({
      ...message,
      tags: {
        ...message.tags,
        Action: 'increment2'
      }
    });

    expect(result3.Error).toContain('ProcessError');
  });

  // test('should not create VM with WASM memory based on a different variant', async () => {
  //   console.log(JSON.stringify(DEBUG_SYNC));
  //   const invalidWasmMemory = joinBuffers(
  //     [Buffer.from(JSON.stringify(DEBUG_SYNC)), Buffer.from(wasmMemory.buffer)],
  //     '|||'
  //   );
  //   const quickJs3 = await quickJSPlugin.process({
  //     contractSource,
  //     wasmMemory: invalidWasmMemory
  //   });

  //   const result3 = await quickJs3.handle(message);
  // });
});
