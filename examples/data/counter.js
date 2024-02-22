function handle(state, message) {
  console.log('handle', message, state);
  const { input } = message;

  if (!state.hasOwnProperty('counter')) {
    state.counter = 0;
  }

  if (input.function == 'increment') {
    console.log('inside increment', state.counter);
    state.counter++;
    return;
  }

  if (input.function == 'currentValue') {
    return {
      result: state.counter,
    };
  }

  throw new ProcessError('unknown action');
}
