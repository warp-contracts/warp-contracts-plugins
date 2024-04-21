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

  if (message.Tags['Action'] == 'random') {
    console.log('random called', Math.random());
    state.random1 = Math.random();
    state.random2 = Math.random();
    state.random3 = Math.random();
    return;
  }
  throw new ProcessError('unknown action');
}
