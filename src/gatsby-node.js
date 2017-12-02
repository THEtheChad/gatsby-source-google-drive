const v4 = require('uuid/v4');
console.log('Google Drive....');

exports.sourceNodes = async ({ boundActionCreators }, opts) => {
  const { createNode } = boundActionCreators
  // Create nodes here, generally by downloading data
  // from a remote API.
  // const data = await fetch(REMOTE_API)

  console.log('options', opts);

  const data = [{ a: 1 }, { a: 2 }, { a: 3 }];

  // Process data into nodes.
  data
    .map(datum => {
      return {
        a: datum.a
        // Required fields.
        id: v4(),
        parent: null, // or null if it's a source node without a parent
        children: [],
        internal: {
          type: `GoogleDrive`,
          contentDigest: crypto
            .createHash(`md5`)
            .update(JSON.stringify(datum))
            .digest(`hex`)
        }
      };
    })
    .forEach(datum => createNode(datum))

  // We're done, return.
  return
}