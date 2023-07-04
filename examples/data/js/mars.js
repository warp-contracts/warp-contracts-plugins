(() => {
  // src/tarket/actions/read/currentPrice.ts
  var currentPrice = async (state, action) => {
    let result = state.currentPrice;
    return { result };
  };

  // src/tarket/actions/read/getOrderbook.ts
  var getOrderbook = async (state, action) => {
    let result = state.orderbook;
    const currentBlock = SmartWeave.block.height;
    result.forEach((order) => {
      order.lockedBy.forEach((wallet) => {
        const locked = state.lockbook[wallet];
        if (currentBlock - locked.lockTime > state.expires) {
          order.locked -= locked.amount;
        }
      });
      order.lockedBy = void 0;
    });
    return { result };
  };

  // src/tarket/actions/read/lockedOrder.ts
  var lockedOrder = async (state, action) => {
    let result;
    const param = action.input.params;
    if (state.lockbook.hasOwnProperty(param.wallet)) {
      const currentBlock = SmartWeave.block.height;
      const locked = state.lockbook[param.wallet];
      if (currentBlock - locked.lockTime > state.expires) {
        return { result };
      } else {
        const lockedOrder2 = state.orderbook.find((order) => order.orderId === locked.orderId);
        result = {
          ...locked,
          orderOwner: lockedOrder2.owner,
          price: lockedOrder2.price
        };
        return { result };
      }
    }
    return { result };
  };

  // src/tarket/actions/read/myOrders.ts
  var myOrders = async (state, action) => {
    const param = action.input.params;
    let result = state.orderbook.filter((order) => order.owner === param.wallet);
    return { result };
  };

  // src/tarket/actions/common.ts
  var contractAssert = (expression, message) => {
    if (!expression) {
      throw new ContractError(`Contract assertion failed: ${message}`);
    }
  };
  function multiplyStringNumber(str1, str2) {
    if (str1 === '0' || str2 === '0') {
      return '0';
    }
    let result = [],
      last1 = null,
      last2 = null,
      mul = null;
    for (let i = 0; i < str1.length; i++) {
      last1 = str1[str1.length - 1 - i];
      for (let j = 0; j < str2.length; j++) {
        last2 = str2[str2.length - 1 - j];
        mul = result[i + j] ? result[i + j] + last1 * last2 : last1 * last2;
        result[i + j] = mul % 10;
        if (mul >= 10) {
          result[i + j + 1] = result[i + j + 1] ? result[i + j + 1] + Math.floor(mul / 10) : Math.floor(mul / 10);
        }
      }
    }
    return result.reverse().join('');
  }

  // src/tarket/actions/write/buy.ts
  var buy = async (state, action) => {
    const target = SmartWeave.transaction.target;
    const quantity = SmartWeave.transaction.quantity;
    if (state.lockbook.hasOwnProperty(action.caller)) {
      const locked = state.lockbook[action.caller];
      const lockedOrder2 = state.orderbook.find((order) => order.orderId === locked.orderId);
      if (lockedOrder2 !== void 0) {
        contractAssert(target === lockedOrder2.owner, 'Transfer $AR to wrong target!');
        contractAssert(
          !SmartWeave.arweave.ar.isLessThan(
            quantity,
            multiplyStringNumber(locked.amount.toString(), lockedOrder2.price)
          ),
          'Transfer wrong quantity of $AR to target!'
        );
        await SmartWeave.contracts.write(state.tokenAddress, {
          function: 'transfer',
          to: action.caller,
          amount: locked.amount
        });
        lockedOrder2.locked -= locked.amount;
        lockedOrder2.amount -= locked.amount;
        lockedOrder2.lockedBy = lockedOrder2.lockedBy.filter((u) => u !== action.caller);
        delete state.lockbook[action.caller];
        state.currentPrice = lockedOrder2.price;
        if (lockedOrder2.amount === 0) {
          state.orderbook = state.orderbook.filter((e) => e.orderId !== locked.orderId);
        }
      }
    }
    return { state };
  };

  // src/tarket/actions/write/cancelOrder.ts
  var cancelOrder = async (state, action) => {
    const param = action.input.params;
    const orderId = param.orderId;
    contractAssert(typeof orderId === 'string', 'Param {orderId} type error!');
    const matchedOrder = state.orderbook.find((order) => order.orderId === orderId);
    contractAssert(matchedOrder !== void 0, `Cannot find specific order {${orderId}} you entered in orderbook!`);
    contractAssert(matchedOrder.owner === action.caller, 'Cannot cancel order not belongs to you!');
    const refundAmount = matchedOrder.amount - matchedOrder.locked;
    matchedOrder.amount = matchedOrder.locked;
    contractAssert(refundAmount !== 0, 'Your order amount is fully locked by others!');
    if (matchedOrder.amount === 0) {
      state.orderbook = state.orderbook.filter((order) => order.orderId !== orderId);
    }
    await SmartWeave.contracts.write(state.tokenAddress, {
      function: 'transfer',
      to: action.caller,
      amount: refundAmount
    });
    return { state };
  };

  // src/tarket/actions/write/lockOrder.ts
  var lockOrder = async (state, action) => {
    const txQty = SmartWeave.transaction.quantity;
    const txTarget = SmartWeave.transaction.target;
    logger.info('txTarget', txTarget);
    logger.info('tx', SmartWeave._activeTx);
    contractAssert(txTarget === state.owner, 'Lock fee sent to wrong target!');
    logger.info('qty', txQty);
    logger.info(SmartWeave.arweave.ar);
    contractAssert(!SmartWeave.arweave.ar.isLessThan(txQty, '5000000000'), 'Lock fee not enough!');
    const param = action.input.params;
    const amount = param.amount;
    const orderId = param.orderId;
    contractAssert(typeof orderId === 'string', 'Param {orderId} type error!');
    contractAssert(
      typeof amount === 'number' && Number.isInteger(amount) && amount > 0,
      'Param {amount} type/value error!'
    );
    const matchedOrder = state.orderbook.find((order) => order.orderId === orderId);
    contractAssert(matchedOrder !== void 0, 'Cannot find specific order you entered as param!');
    if (state.lockbook.hasOwnProperty(action.caller)) {
      const locked = state.lockbook[action.caller];
      const lockedOrder2 = state.orderbook.find((order) => order.orderId === locked.orderId);
      if (lockedOrder2 !== void 0) {
        lockedOrder2.locked -= locked.amount;
        lockedOrder2.lockedBy = lockedOrder2.lockedBy.filter((u) => u !== action.caller);
      }
    }
    const currentBlock = SmartWeave.block.height;
    matchedOrder.lockedBy.forEach((user) => {
      if (currentBlock - state.lockbook[user].lockTime > state.expires) {
        matchedOrder.locked -= state.lockbook[user].amount;
        matchedOrder.lockedBy = matchedOrder.lockedBy.filter((u) => user !== u);
        delete state.lockbook[user];
      }
    });
    matchedOrder.locked += amount;
    contractAssert(matchedOrder.locked <= matchedOrder.amount, 'Amount you lock exceeds max amount!');
    matchedOrder.lockedBy.push(action.caller);
    state.lockbook[action.caller] = {
      orderId,
      amount,
      lockTime: currentBlock
    };
    return { state };
  };

  // src/tarket/actions/write/placeOrder.ts
  var placeOrder = async (state, action) => {
    const param = action.input.params;
    const price = param.price;
    contractAssert(typeof price === 'string', 'Param {price} type error!');
    const orderAmount = await checkOrderQuantity(state, action);
    contractAssert(orderAmount > 0, 'Allowance should be greater than 0!');
    state.orderbook.push({
      orderId: SmartWeave.transaction.id,
      owner: action.caller,
      amount: orderAmount,
      locked: 0,
      lockedBy: [],
      price
    });
    state.orderbook.sort((a, b) => SmartWeave.arweave.ar.compare(a.price, b.price));
    return { state };
  };
  var checkOrderQuantity = async (state, action) => {
    const tokenAddress = state.tokenAddress;
    const tokenState = await SmartWeave.contracts.viewContractState(tokenAddress, {
      function: 'allowance',
      owner: action.caller,
      spender: SmartWeave.contract.id
    });
    let orderQuantity = tokenState.result.allowance;
    await SmartWeave.contracts.write(tokenAddress, {
      function: 'transferFrom',
      from: action.caller,
      to: SmartWeave.contract.id,
      amount: orderQuantity
    });
    return orderQuantity;
  };

  // src/tarket/contract.ts
  async function handle(state, action) {
    const func = action.input.function;
    switch (func) {
      case 'buy':
        return await buy(state, action);
      case 'cancelOrder':
        return await cancelOrder(state, action);
      case 'lockOrder':
        return await lockOrder(state, action);
      case 'placeOrder':
        return await placeOrder(state, action);
      case 'lockedOrder':
        return await lockedOrder(state, action);
      case 'getOrderbook':
        return await getOrderbook(state, action);
      case 'currentPrice':
        return await currentPrice(state, action);
      case 'myOrders':
        return await myOrders(state, action);
      default:
        throw new ContractError(`No function supplied or function not recognised: "${func}"`);
    }
  }
})();
