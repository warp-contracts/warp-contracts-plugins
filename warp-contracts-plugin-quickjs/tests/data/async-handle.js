async function handle(state, message) {
  console.log('handle');
  const result = await readFile('example.txt');
  console.log('after readFile', result);
  ao.send({
    file: result
  });
}