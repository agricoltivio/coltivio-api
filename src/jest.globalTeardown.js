module.exports = async function (globalConfig, projectConfig) {
  await global.__POSTGRES__.stop();
};
