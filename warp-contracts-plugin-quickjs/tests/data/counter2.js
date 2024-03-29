function handle(state, message) {
  console.log('reading from counter2');
  console.log(message.Tags);
  console.log(ao.send);
  if (!state.hasOwnProperty('counter')) {
    state.counter = 0;
  }

  if (message.Tags.find((t) => t.value == 'increment')) {
    state.counter++;
    ao.send({
      counter: state.counter
    });
    return;
  }

  if (message.Tags.find((t) => t.value == 'result')) {
    ao.result({
      counter: state.counter
    });
    return;
  }

  console.log('unknown function');
}
