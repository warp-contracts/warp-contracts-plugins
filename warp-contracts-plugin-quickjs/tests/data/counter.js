function handle(state, message) {
  if (!state.hasOwnProperty('counter')) {
    state.counter = 0;
  }

  if (message.tags['Action'] == 'increment') {
    state.counter++;
    ao.send({
      counter: state.counter
    });
    return;
  }

  if (message.tags['Action'] == 'currentValue') {
    return {
      result: state.counter
    };
  }

  throw new ProcessError('unknown action');
}
