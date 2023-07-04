(() => {
  // ../../atomic-asset-typescript/dist/lib/error.js
  var ContractErrors = {
    RuntimeError: (message) => new ContractError(`[RE:RE] ${message}`),
    CallerBalanceNotEnough: (amount) => new ContractError(`[CE:CallerBalanceNotEnough ${amount}]`),
    CallerAllowanceNotEnough: (amount) => new ContractError(`[CE:CallerAllowanceNotEnough ${amount}]`),
    AllowanceHasToGtThenZero: () => new ContractError(`[CE:AllowanceHasToGtThenZero]`)
  };

  // ../../atomic-asset-typescript/dist/lib/utils.js
  function getOr(value, defaultVal) {
    if (value) {
      return value;
    }
    return defaultVal;
  }
  function getCaller() {
    const mCaller = SmartWeave.caller;
    if (!mCaller) {
      throw ContractErrors.RuntimeError('SmartWeave.caller is undefined');
    }
    return mCaller;
  }
  function Result(data) {
    return { result: data };
  }
  var isAddress = (value, name) => {
    if (!(typeof value === 'string' && value !== '')) {
      throw ContractErrors.RuntimeError(`Validation error: "${name}" has to be non-empty string`);
    }
  };
  var isUInt = (value, name) => {
    if (!(typeof value === 'number' && Number.isSafeInteger(value) && !Number.isNaN(value) && value >= 0)) {
      throw ContractErrors.RuntimeError(`Validation error: "${name}" has to be integer and >= 0`);
    }
  };

  // ../../atomic-asset-typescript/dist/lib/allowance.js
  function allowance(state, owner2, spender) {
    isAddress(owner2, 'owner');
    isAddress(spender, 'spender');
    const allowance2 = getOr(getOr(state.allowances[owner2], {})[spender], 0);
    return Result({
      allowance: allowance2,
      owner: owner2,
      spender
    });
  }
  function approve(state, spender, amount) {
    const caller = getCaller();
    isAddress(spender, 'spender');
    isUInt(amount, 'amount');
    return _approve(state, caller, spender, amount);
  }
  function decreaseAllowance(state, spender, amountToSubtract) {
    const caller = getCaller();
    isAddress(spender, 'spender');
    isUInt(amountToSubtract, 'amountToSubtract');
    const {
      result: { allowance: currentAllowance }
    } = allowance(state, caller, spender);
    if (amountToSubtract > currentAllowance) {
      throw ContractErrors.AllowanceHasToGtThenZero();
    }
    return _approve(state, caller, spender, currentAllowance - amountToSubtract);
  }
  function increaseAllowance(state, spender, amountToAdd) {
    const caller = getCaller();
    isAddress(spender, 'spender');
    isUInt(amountToAdd, 'amountToAdd');
    const {
      result: { allowance: currentAllowance }
    } = allowance(state, caller, spender);
    return _approve(state, caller, spender, currentAllowance + amountToAdd);
  }
  function _approve(state, owner2, spender, amount) {
    if (amount > 0) {
      const ownerAllowance = getOr(state.allowances[owner2], {});
      state.allowances[owner2] = {
        ...ownerAllowance,
        [spender]: amount
      };
    } else {
      const ownerAllowance = state.allowances[owner2];
      if (!ownerAllowance) {
        return { state };
      }
      delete state.allowances[owner2][spender];
      if (Object.keys(ownerAllowance).length === 0) {
        delete state.allowances[owner2];
      }
    }
    return { state };
  }

  // ../../atomic-asset-typescript/dist/lib/balance.js
  function balanceOf(state, target) {
    var _a;
    isAddress(target, 'target');
    return Result({
      balance: (_a = state.balances[target]) !== null && _a !== void 0 ? _a : 0,
      target
    });
  }
  function totalSupply(state) {
    return Result({
      value: state.totalSupply
    });
  }
  function owner(state) {
    return Result({
      value: state.owner
    });
  }

  // ../../atomic-asset-typescript/dist/lib/transfer.js
  function transfer(state, to, amount) {
    const from = getCaller();
    isAddress(to, 'to');
    isUInt(amount, 'amount');
    return _transfer(state, from, to, amount);
  }
  function transferFrom(state, from, to, amount) {
    const caller = getCaller();
    isAddress(to, 'to');
    isAddress(from, 'from');
    isUInt(amount, 'amount');
    const {
      result: { allowance: allowed }
    } = allowance(state, from, caller);
    if (allowed < amount) {
      throw ContractErrors.CallerAllowanceNotEnough(allowed);
    }
    _approve(state, from, caller, allowed - amount);
    return _transfer(state, from, to, amount);
  }
  function _transfer(state, from, to, amount) {
    const balances = state.balances;
    const fromBalance = getOr(balances[from], 0);
    if (fromBalance < amount) {
      throw ContractErrors.CallerBalanceNotEnough(fromBalance);
    }
    const newFromBalance = fromBalance - amount;
    if (newFromBalance === 0) {
      delete balances[from];
    } else {
      balances[from] = newFromBalance;
    }
    let toBalance = getOr(balances[to], 0);
    balances[to] = toBalance + amount;
    _claimOwnership(state, from);
    _claimOwnership(state, to);
    return { state };
  }
  function _claimOwnership(state, potentialOwner) {
    const currentBalance = getOr(state.balances[potentialOwner], 0);
    if (currentBalance === state.totalSupply) {
      state.owner = potentialOwner;
    } else if (state.owner && currentBalance > 0) {
      state.owner = null;
    }
  }

  // ../../atomic-asset-typescript/dist/contract/atomic-asset.js
  function handle(state, action) {
    const { input } = action;
    switch (action.input.function) {
      case FUNCTIONS.TRANSFER:
        return transfer(state, input.to, input.amount);
      case FUNCTIONS.TRANSFER_FROM:
        return transferFrom(state, input.from, input.to, input.amount);
      case FUNCTIONS.APPROVE:
        return approve(state, input.spender, input.amount);
      case FUNCTIONS.ALLOWANCE:
        return allowance(state, input.owner, input.spender);
      case FUNCTIONS.BALANCE_OF:
        return balanceOf(state, input.target);
      case FUNCTIONS.TOTAL_SUPPLY:
        return totalSupply(state);
      case FUNCTIONS.INCREASE_ALLOWANCE:
        return increaseAllowance(state, input.spender, input.amountToAdd);
      case FUNCTIONS.DECREASE_ALLOWANCE:
        return decreaseAllowance(state, input.spender, input.amountToSubtract);
      case FUNCTIONS.OWNER:
        return owner(state);
      default:
        throw new ContractError(`Function ${action.input.function} is not supported by this contract`);
    }
  }
  var FUNCTIONS;
  (function (FUNCTIONS2) {
    FUNCTIONS2['TRANSFER'] = 'transfer';
    FUNCTIONS2['TRANSFER_FROM'] = 'transferFrom';
    FUNCTIONS2['ALLOWANCE'] = 'allowance';
    FUNCTIONS2['APPROVE'] = 'approve';
    FUNCTIONS2['BALANCE_OF'] = 'balanceOf';
    FUNCTIONS2['TOTAL_SUPPLY'] = 'totalSupply';
    FUNCTIONS2['OWNER'] = 'owner';
    FUNCTIONS2['INCREASE_ALLOWANCE'] = 'increaseAllowance';
    FUNCTIONS2['DECREASE_ALLOWANCE'] = 'decreaseAllowance';
  })(FUNCTIONS || (FUNCTIONS = {}));
})();
