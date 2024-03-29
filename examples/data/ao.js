function handle(state, message) {
  if (!state.hasOwnProperty('balances')) {
    state.balances = {};
    state.balances[ao.id] = 100000000000000;
  }

  if (state.name != 'Points Coin') {
    state.name = 'Points Coin';
  }

  if (state.ticker != 'Points') {
    state.ticker == 'PNTS';
  }

  if (state.denomination != 10) {
    state.denomination = 10;
  }

  if (!state.hasOwnProperty('logo')) {
    state.logo = 'SBCCXwwecBlDqRLUjb8dYABExTJXLieawf7m2aBJ-KY';
  }

  if (message.tags['Action'] == 'info') {
    ao.result({
      target: ao.id,
      tags: {
        name: state.name,
        ticker: state.ticker,
        logo: state.logo,
        denomination: state.denomination.toString(),
      },
    });
    return;
  }

  if (message.tags['Action'] == 'balances') {
    ao.result({
      target: ao.id,
      data: state.balances,
    });
    return;
  }

  if (message.tags['Action'] == 'transfer') {
    if (typeof message.tags['Recipient'] != 'string') {
      throw new ProcessError('Recipient is required!');
    }

    if (typeof message.tags['Quantity'] != 'string') {
      throw new ProcessError('Quantity is required!');
    }

    if (!state.balances[message.from]) {
      state.balances[message.from] = 0;
    }

    if (!state.balances[message.tags['Recipient']]) {
      state.balances[message.tags['Recipient']] = 0;
    }

    const qty = Number(message.tags['Quantity']);
    if (!qty) {
      throw new ProcessError('qty must must be a number');
    }

    if (state.balances[message.from] >= qty) {
      state.balances[message.from] = state.balances[message.from] - qty;
      state.balances[message.tags['Recipient']] =
        state.balances[message.tags['Recipient']] + qty;

      if (!message.tags['Cast']) {
        ao.send({
          target: message.from,
          tags: [
            { name: 'Action', value: 'Debit-Notice' },
            { name: 'Recipient', value: message.tags['Recipient'] },
            { name: 'Quantity', value: qty.toString() },
          ],
        });

        ao.send({
          target: message.from,
          tags: [
            { name: 'Action', value: 'Credit-Notice' },
            { name: 'Sender', value: message.tags['Recipient'] },
            { name: 'Quantity', value: qty.toString() },
          ],
        });

        return;
      }

      return;
    } else {
      ao.send({
        target: message.from,
        tags: [
          { name: 'Action', value: 'Transfer-Error' },
          { name: 'MessageId', value: message.id },
          { name: 'Error', value: 'Insufficient balance' },
        ],
      });

      return;
    }
  }

  throw new ProcessError('unknown action');
}
