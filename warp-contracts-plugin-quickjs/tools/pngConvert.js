const hexString = "89504e470d0a1a0a0000000d4948445200000008000000080806000000c40fbe8b000000d949444154780155c1bd4ac3501cc6e1df7b3c2d69d1e606a4227eb48320389a31f50ef40edc9d3afbb1767575151777418a530517455dd2d9b94bc0444c387f43379f47342c4b06544c2c584ae36aff79ed3c4b76349ccd655932e0d75ee9f92e79cd52cf435e17b475e0a9988c4e3ffb16b4f578b3f742e3e8e42d0945f4f174b77beb2c586a55b51a14360508300bdb443f91054b15de0fbf055de33f01068593d394d8d3280d30964a628f9ca68e1663f2ba50ec3b0e7002c5be435e17b418af5c5e7f2d2ecefaf794b6015a37a356650fb475ace16cfe07739a557038c5fecf0000000049454e44ae426082"; // This should be the full hex representation of a PNG image


// Convert the hex string to a Uint8Array (binary format)
function hexToBinary(hexString) {
    const length = hexString.length / 2;
    const binaryData = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        binaryData[i] = parseInt(hexString.substr(i * 2, 2), 16);
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

// Convert hex to base64
const binaryData = hexToBinary(hexString);
console.log(binaryData);

const base64String = binaryToBase64(binaryData);

// You can now use this base64String for displaying the image in an <img> element, for example:
// <img src="data:image/png;base64,${base64String}" />
console.log(base64String);