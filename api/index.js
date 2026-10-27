const { getDb } = require('../src/db');
const { createHandler } = require('../src/server');

let handlerPromise = null;

function getHandler() {
  if (!handlerPromise) {
    handlerPromise = getDb()
      .then((db) => createHandler(db))
      .catch((error) => {
        handlerPromise = null;
        throw error;
      });
  }
  return handlerPromise;
}

module.exports = async (req, res) => {
  const handler = await getHandler();
  return handler(req, res);
};
