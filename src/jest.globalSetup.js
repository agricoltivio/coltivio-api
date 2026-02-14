const { PostgreSqlContainer } = require("@testcontainers/postgresql");

module.exports = async function (globalConfig, projectConfig) {
  const POSTGRES_DB = "coltivio";
  const POSTGRES_USER = "coltivio";
  const POSTGRES_PASSWORD = "coltiio";
  const POSTGRES_PORT = 5432;

  const dbContainer = await new PostgreSqlContainer()
    .withUsername(POSTGRES_USER)
    .withPassword(POSTGRES_PASSWORD)
    .withDatabase(POSTGRES_DB)
    .withExposedPorts(POSTGRES_PORT)
    .start();

  global.__POSTGRES__ = dbContainer;
};
