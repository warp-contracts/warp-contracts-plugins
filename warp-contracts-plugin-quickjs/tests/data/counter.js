function handle(state, message) {
  const { input } = message;

  if (!state.hasOwnProperty('counter')) {
    state.counter = 0;
  }

  if (message.tags['Action'] == 'increment') {
    console.log('inside increment', state.counter);
    state.counter++;
    ao.send({
      counter: state.counter
    });
    return;
  }

  if (input.function == 'currentValue') {
    return {
      result: state.counter
    };
  }

  throw new ProcessError('unknown action');
}
