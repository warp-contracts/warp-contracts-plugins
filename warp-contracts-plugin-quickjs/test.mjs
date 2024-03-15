import { WarpFactory } from 'warp-contracts';
import fs from 'fs';

const warp = WarpFactory.forMainnet({ dbLocation: 'cache/without-dre' });
const warp2 = WarpFactory.forMainnet({ dbLocation: 'cache/with-dre' });

(async () => {
  const contract = warp.contract('w5ZU15Y2cLzZlu3jewauIlnzbKw-OAxbN9G5TbuuiDQ');
  const validityKeys = (await contract.readState()).cachedValue;
  console.log(Object.keys(validityKeys.validity).length);
  const validity = Object.keys(validityKeys.validity);
  // console.log('Total Repos: ', Object.keys(validity).length);

  // const contract2 = warp2
  //   .contract('w5ZU15Y2cLzZlu3jewauIlnzbKw-OAxbN9G5TbuuiDQ')
  //   .setEvaluationOptions({ remoteStateSyncEnabled: true });

  // const validity2 = (await contract2.readState()).cachedValue.validity;
  // console.log('Total Repos 2: ', Object.keys(validity2).length);

  // const response = await fetch(
  //   'https://dre-1.warp.cc/contract?id=w5ZU15Y2cLzZlu3jewauIlnzbKw-OAxbN9G5TbuuiDQ&validity=true&errorMessages=true&events=true&limit=1968'
  // ).then((res) => res.json());
  // const validity2 = Object.keys(response.validity);
  const test = fs.readFileSync('dre-all-1.json', 'utf-8');
  const validity2 = JSON.parse(test).map((t) => t.tx_id);
  console.log(validity2);
  const missing = validity2.filter(function (el) {
    return validity.indexOf(el) < 0;
  });
  console.log(missing);
})();
