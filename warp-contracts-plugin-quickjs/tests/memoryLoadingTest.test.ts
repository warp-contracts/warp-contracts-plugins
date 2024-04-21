import {
  DefaultEvaluationOptions,
  LoggerFactory,
  QuickJsPluginInput,
  QuickJsPluginMessage,
  SmartWeaveGlobal
} from 'warp-contracts';
import { QuickJsPlugin } from '../src';
import fs from 'fs';
import { expect, test, describe, beforeAll } from 'vitest';
import { QuickJsHandlerApi } from '../src/QuickJsHandlerApi';

describe('Memory loading test', () => {
  let contractSource: string;
  let quickJSPlugin: QuickJsPlugin<unknown>;
  let message, messageRandom1, messageRandom2: QuickJsPluginMessage;
  let contractState: any;
  let quickJs: QuickJsHandlerApi<unknown>;
  const initState = {
    counter: 0
  }

  beforeAll(async () => {
    LoggerFactory.INST.logLevel('error');

    contractSource = fs.readFileSync('tests/data/counter.js', 'utf-8');
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

    messageRandom1 = {
      ...message,
      Tags: {
        type: 'Message',
        variant: 'ao.TN.1',
        'Data-Protocol': 'ao',
        'From-Module': 'PR72afhcby-x9c9Jg--utxw9L8_ZCOyjCgnUhp2JSMA',
        'From-Process': 'jliaItK34geaPuyOYVqh8fsRgXIXWwa9iLJszGXKOHE',
        Action: 'random'
      },
    }
    messageRandom2 = {
      ...messageRandom1,
      Signature: 'xxx'
    }

    quickJs = await quickJSPlugin.process({
      contractSource,
      binaryType: "release_sync"
    } as QuickJsPluginInput);
  });

  test('should correctly handle message', async () => {
    const result = await quickJs.handle(message, initState);
    expect(result.Messages.length).toBe(1);
    expect(result.Messages[0].Tags.find((t: { name: string; value: string }) => t.name == 'counter').value).toEqual(1);
  });

  test('should return contract state in result', async () => {
    const quickJs = await quickJSPlugin.process({
      contractSource,
      binaryType: "release_sync"
    } as QuickJsPluginInput);

    const result = await quickJs.handle(message);

    contractState = result.State;

    expect(contractState.counter).toEqual(1);
  });

  test('should properly use PRNG', async () => {
    const quickJs = await quickJSPlugin.process({
      contractSource,
      binaryType: "release_sync"
    } as QuickJsPluginInput);

    const result1 = await quickJs.handle(messageRandom1);

    contractState = result1.State;
    const firstRandom = contractState.random1;
    expect(contractState.random1).toEqual(contractState.random2);
    expect(contractState.random2).toEqual(contractState.random3);

    const result2 = await quickJs.handle(messageRandom2);
    contractState = result2.State;
    const secondRandom = contractState.random1;
    expect(firstRandom).not.toEqual(secondRandom);
    expect(contractState.random1).toEqual(contractState.random2);
    expect(contractState.random2).toEqual(contractState.random3);



    console.log("RANDOM: ", contractState.random);
    //expect(contractState.random).toEqual(1);
  });

  /*test('should respect passed current state', async () => {
    const quickJs2 = await quickJSPlugin.process({
      contractSource,
      binaryType: "release_sync"
    } as QuickJsPluginInput);

    let result;
    result = await quickJs2.handle(message, contractState);
    contractState = result.State;
    result = await quickJs2.handle(message, contractState)
    contractState = result.State;
    result = await quickJs2.handle(message, contractState)
    contractState = result.State;
    const result2 = await quickJs2.handle(message, contractState);
    expect(result2.Messages[0].Tags.find((t: { name: string; value: string }) => t.name == 'counter').value).toEqual(5);

    contractState = result2.State;
  });

  test('should correctly handle ProcessError', async () => {
    const quickJs3 = await quickJSPlugin.process({
      contractSource,
      binaryType: "release_sync"
    } as QuickJsPluginInput);

    const result3 = await quickJs3.handle({
      ...message,
      Tags: {
        ...message.Tags,
        Action: 'increment2'
      }
    });

    expect(result3.Error).toContain('ProcessError');
    expect(result3.Messages).toBeNull();
    expect(result3.Spawns).toBeNull();
    expect(result3.Output).toBeNull();
  });*/

});
