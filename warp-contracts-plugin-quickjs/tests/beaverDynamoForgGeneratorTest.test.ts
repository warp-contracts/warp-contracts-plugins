import {LoggerFactory, QuickJsPluginInput, QuickJsPluginMessage} from 'warp-contracts';
import { QuickJsPlugin } from '../src';
import fs from 'fs';
import { expect, test, describe, beforeAll } from 'vitest';
import { QuickJsHandlerApi } from '../src/QuickJsHandlerApi';
import { PNG } from 'pngjs';

describe('just pick one already', () => {
  let contractSource: string;
  let quickJSPlugin: QuickJsPlugin<unknown>;
  let message: QuickJsPluginMessage;
  let riseMessage: QuickJsPluginMessage;
  let wasmMemory: Buffer;
  let quickJs: QuickJsHandlerApi<unknown>;

  beforeAll(async () => {
    LoggerFactory.INST.logLevel('error');

    contractSource = fs.readFileSync('tests/data/beaver-forge.js', 'utf-8');
    quickJSPlugin = new QuickJsPlugin({});

    message = {
      Cron: false,
      Data: 'Hello ao',
      Epoch: 0,
      From: 'jliaItK34geaPuyOYVqh8fsRgXIXWwa9iLJszGXKOHE',
      Id: '1Jy99GiGQryL9MzdgYe4KyQ5UmdRWTMJfGXc7vxEZ-0',
      Nonce: 1,
      Owner: 'jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M',
      Signature:
        'ClPGScgzfNjKUpBM8BxIr2MPlGsVtHMxxQBvs7k9nRAzUlnTQmkcqSmDJk1GA0iQcDHD3-DWXIkWYXUuPwWqYKQOletl5n4FdOTg6xWeXqYd-mpeHPPzpaadhsWs_XCzEt6QSAaRVg1HR79fhIJxCzbWAftwCSMzI-pzQ6HAgCjyy-QFIPthd8UGShnBg0qEmBIvZTOhUK6f6S7cDbphWnb_vLmatNTSAp3iDdTbIewjwFytmFonDn_Er0GYlJ1jGVWfBfjORtPNPsQR-yBqN54HUPTnJ86YzGI3uFTl43Y5E0bGpwLgH78Sz1Db8bziAduXLSVcaPhrYDAmTa7VyiCjAOM3Z1I3ih_BSPUph4GE5BV0JSfSWGvf5Sh2-5E5vkiXjytcY82BGMqbFza6Q1A-ak_btT80eDDbbRdjGjZbulAhHJNYP0DLI-WT0pbxMeOIcMbnVWDbpNvjyM94oQw6IOh706U7rKlf5hz4aadzr9vi1jbSVRJS3Gs58533ax2r-EV1b_22KIgR_aGZcMfIyRuYCE3mUvKOuTjOaN8HmjUnX6YRjJxMWt12QWbTILcyDc_r9Eu3h3z_wZAD3dPAiSu74TS5ErZ_Eyfb3DN32wT-KqQIFS0bzXICi-e4hC-G_v_KPLLeX6sP_kB1n141iGgUj0kyunh2_Mnfs_4',
      Tags: {
        type: 'Message',
        variant: 'ao.TN.1',
        'Data-Protocol': 'ao',
        'From-Module': 'PR72afhcby-x9c9Jg--utxw9L8_ZCOyjCgnUhp2JSMA',
        'From-Process': 'jliaItK34geaPuyOYVqh8fsRgXIXWwa9iLJszGXKOHE',
        Action: 'increment'
      },
      Target: '',
      Timestamp: '1708592722',
      'Block-Height': '1369091',
      'Forwarded-By': 'z1pq2WzmaYnfDwvEFgUZBj48anUsxxN64ZjbWOsIn08',
      'Hash-Chain': 'hJ0B-0yxKxeL3IIfaIIF7Yr6bFLG2vQayaF8G0EpjbY'
    };

    riseMessage = {
      Cron: false,
      Data: 'Hello ao',
      Epoch: 0,
      From: 'jliaItK34geaPuyOYVqh8fsRgXIXWwa9iLJszGXKOHE',
      Id: '1Jy99GiGQryL9MzdgYe4KyQ5UmdRWTMJfGXc7vxEZ-0',
      Nonce: 1,
      Owner: 'jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M',
      Signature:
        'ClPGScgzfNjKUpBM8BxIr2MPlGsVtHMxxQBvs7k9nRAzUlnTQmkcqSmDJk1GA0iQcDHD3-DWXIkWYXUuPwWqYKQOletl5n4FdOTg6xWeXqYd-mpeHPPzpaadhsWs_XCzEt6QSAaRVg1HR79fhIJxCzbWAftwCSMzI-pzQ6HAgCjyy-QFIPthd8UGShnBg0qEmBIvZTOhUK6f6S7cDbphWnb_vLmatNTSAp3iDdTbIewjwFytmFonDn_Er0GYlJ1jGVWfBfjORtPNPsQR-yBqN54HUPTnJ86YzGI3uFTl43Y5E0bGpwLgH78Sz1Db8bziAduXLSVcaPhrYDAmTa7VyiCjAOM3Z1I3ih_BSPUph4GE5BV0JSfSWGvf5Sh2-5E5vkiXjytcY82BGMqbFza6Q1A-ak_btT80eDDbbRdjGjZbulAhHJNYP0DLI-WT0pbxMeOIcMbnVWDbpNvjyM94oQw6IOh706U7rKlf5hz4aadzr9vi1jbSVRJS3Gs58533ax2r-EV1b_22KIgR_aGZcMfIyRuYCE3mUvKOuTjOaN8HmjUnX6YRjJxMWt12QWbTILcyDc_r9Eu3h3z_wZAD3dPAiSu74TS5ErZ_Eyfb3DN32wT-KqQIFS0bzXICi-e4hC-G_v_KPLLeX6sP_kB1n141iGgUj0kyunh2_Mnfs_4',
      Tags: {
        type: 'Message',
        variant: 'ao.TN.1',
        'Data-Protocol': 'ao',
        'From-Module': 'PR72afhcby-x9c9Jg--utxw9L8_ZCOyjCgnUhp2JSMA',
        'From-Process': 'jliaItK34geaPuyOYVqh8fsRgXIXWwa9iLJszGXKOHE',
        Action: 'rise'
      },
      Target: '',
      Timestamp: '1708592722',
      'Block-Height': '1369091',
      'Forwarded-By': 'z1pq2WzmaYnfDwvEFgUZBj48anUsxxN64ZjbWOsIn08',
      'Hash-Chain': 'hJ0B-0yxKxeL3IIfaIIF7Yr6bFLG2vQayaF8G0EpjbY'
    };

    quickJs = await quickJSPlugin.process({
      contractSource,
      binaryType: "release_sync"
    } as QuickJsPluginInput);
  });

  test('should correctly handle message', async () => {
    const result = await quickJs.handle(message);
    expect(result.Messages.length).toBe(1);
    expect(result.Messages[0].Tags.find((t: { name: string; value: string }) => t.name == 'counter').value).toEqual(1);
  });

  test('rise up... beaver...', async () => {
    const quickJs2 = await quickJSPlugin.process({
      contractSource,
      binaryType: "release_sync"
    } as QuickJsPluginInput);

    const result2 = await quickJs2.handle(riseMessage);
    const spawnedPng = PNG.sync.read(Buffer.from(result2.Spawns[0].Data, 'base64'));
    const actualPng = PNG.sync.read(fs.readFileSync('./tests/img/result.png'));
    expect(spawnedPng).toEqual(actualPng);

  });
});
