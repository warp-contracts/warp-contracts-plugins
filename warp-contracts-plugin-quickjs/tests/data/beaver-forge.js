function handle(state, message) {
  if (!state.hasOwnProperty('counter')) {
    state.counter = 0;
  }

  if (message.Tags['Action'] === 'increment') {
    state.counter++;
    ao.send({
      counter: state.counter
    });
    return;
  }

  if (message.Tags['Action'] === 'rise') {
    let result = body();
    const eyesPngObj = eyes();

    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        // Merge pixels by overwriting png1 with png2
        const idx = (result.width * y + x) << 2;
        if (eyesPngObj.data[idx] > 0) {
          result.data[idx] = eyesPngObj.data[idx];
          result.data[idx + 1] = eyesPngObj.data[idx + 1];
          result.data[idx + 2] = eyesPngObj.data[idx + 2];
          result.data[idx + 3] = eyesPngObj.data[idx + 3]; // Alpha channel
        }
      }
    }

    let resParsed = PNG.parse(result);
    console.log(resParsed);


    // Convert the Buffer to a base64 encoded string
    //const buffer = PNG.sync.write(result);
    //const base64String = buffer.toString('base64');
    //console.log(base64String);
    /*const binaryData = hexToBinary(resParsed);

    console.log(binaryData);

    const base64String = binaryToBase64(binaryData);

    console.log(base64String);*/

    state.counter++;

    ao.spawn('beaverWeaver', {
      Data: resParsed
    });

    return;
  }

  throw new ProcessError('unknown action');
}


function hexToBinary(hexString) {
  const length = hexString.length / 2;
  const binaryData = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    binaryData[i] = parseInt(hexString.substring(i * 2, 2), 16);
  }
  return binaryData;
}

// Convert binary data to a base64 string
function binaryToBase64(binaryData) {
  let binaryString = "";
  binaryData.forEach(byte => {
    binaryString += String.fromCharCode(byte);
  });
  return btoa(binaryString);
}

function body() {
  return {
    width: 8,
    height: 8,
    depth: 8,
    interlace: false,
    palette: false,
    color: true,
    alpha: true,
    bpp: 4,
    colorType: 6,
    data: new Uint8Array([0,0,0,0,255,216,59,39,255,211,59,178,254,209,58,245,254,209,58,245,255,211,59,178,255,216,59,39,0,0,0,0,255,216,59,39,255,210,58,245,255,224,62,255,255,210,58,255,255,210,58,255,255,224,62,255,255,210,58,245,255,216,59,39,255,211,59,178,255,224,62,255,254,209,58,246,253,209,58,255,253,209,58,255,254,209,58,246,255,224,62,255,255,211,59,178,254,209,58,245,255,209,58,255,254,209,58,255,254,209,58,255,254,209,58,255,254,209,58,255,255,209,58,255,254,209,58,245,254,209,58,245,255,209,58,255,254,209,58,255,254,209,58,255,254,209,58,255,254,209,58,255,255,209,58,255,254,209,58,245,255,211,59,178,255,224,62,255,254,209,58,246,253,209,58,255,253,209,58,255,254,209,58,246,255,224,62,255,255,211,59,178,255,216,59,39,255,210,58,245,255,224,62,255,255,209,58,255,255,210,58,255,255,224,62,255,255,210,58,245,255,216,59,39,0,0,0,0,255,216,59,39,255,211,59,178,255,210,59,244,254,209,58,245,255,211,59,178,255,216,59,39,0,0,0,0]),
    gamma: 0
  };
}

function eyes() {
  return {
    width: 8,
    height: 8,
    depth: 8,
    interlace: false,
    palette: false,
    color: true,
    alpha: true,
    bpp: 4,
    colorType: 6,
    data: new Uint8Array([0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,0,128,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,67,54,13,19,66,52,14,54,0,0,0,0,0,0,0,0,66,53,13,58,64,43,21,12,0,0,0,0,0,0,0,0,66,49,8,31,64,53,12,87,0,0,0,0,0,0,0,0,65,52,11,94,64,51,13,20,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),
    gamma: 0
  };
}
