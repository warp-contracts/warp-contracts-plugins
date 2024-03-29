function handle(state, message) {
  if (!state.hasOwnProperty('counter')) {
    state.counter = 0;
  }
  console.log('AO: console log test');

  if (message.Tags['Action'] == 'increment') {
    state.counter++;
    ao.send({
      counter: state.counter
    });
    return;
  }

  if (message.Tags['Action'] == 'currentValue') {
    return {
      result: state.counter
    };
  }

  throw new ProcessError('unknown action');
}
