// import {
//   PostgreSqlContainer,
//   StartedPostgreSqlContainer,
// } from "@testcontainers/postgresql";
// import { v4 as uuidv4 } from "uuid";
// import util from "util";
// import { exec } from "child_process";
// import { PrismaClient } from "@prisma/client";
// import { jest } from "@jest/globals";
// import { setPrimaClient } from "./db";
// import { getSdk } from "./__generated__/graphql-test-queries";
// import { GraphQLClient } from "graphql-request";

// const execPromise = util.promisify(exec);

// const POSTGRES_DB = "pastorino";
// const POSTGRES_USER = "pastorino";
// const POSTGRES_PASSWORD = "pastorino";
// const POSTGRES_PORT = 5432;

// export async function setupTestDbWithPrismaClient(schema: string) {
//   jest.setTimeout(100000);

//   //   const dbContainer: StartedPostgreSqlContainer = await new PostgreSqlContainer(
//   //     "postgres"
//   //   )
//   //     .withUsername(POSTGRES_USER)
//   //     .withPassword(POSTGRES_PASSWORD)
//   //     .withDatabase(POSTGRES_DB)
//   //     .withExposedPorts(POSTGRES_PORT)
//   //     .start();
//   //@ts-ignore
//   const dbContainer: StartedPostgreSqlContainer = global.__POSTGRES__;
//   const connectionString = `postgresql://${dbContainer.getUsername()}:${dbContainer.getPassword()}@${dbContainer.getHost()}:${dbContainer.getMappedPort(
//     POSTGRES_PORT
//   )}/${dbContainer.getDatabase()}?schema=${schema}`;

//   process.env.DATABASE_URL = connectionString;
//   global.process.env.DATABASE_URL = connectionString;

//   try {
//     // Run the migrations to ensure our schema has the required structure
//     await execPromise(
//       `DATABASE_URL="${connectionString}" ./node_modules/.bin/prisma migrate deploy`
//     );
//   } catch (e) {
//     console.log(e);
//   }

//   // Set references in order to provide access during teardown.
//   //@ts-ignore
//   //   global.__POSTGRES__ = dbContainer;
//   global.process.env.DATABASE_SCHEMA = schema;

//   const prisma = new PrismaClient({ datasourceUrl: connectionString });

//   setPrimaClient(prisma);

//   return prisma;
// }

// export async function clearAllTableData(
//   prisma: PrismaClient,
//   excludeTables: string[] = []
// ) {
//   const schema = process.env.DATABASE_SCHEMA!;
//   const tablenames = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
//     `SELECT tablename FROM pg_tables WHERE schemaname='${schema}'`
//   );

//   const tables = tablenames
//     .map(({ tablename }) => tablename)
//     .filter(
//       (name) => name !== "_prisma_migrations" && !excludeTables.includes(name)
//     )
//     .map((name) => `"${schema}"."${name}"`)
//     .join(", ");

//   try {
//     const query = `TRUNCATE TABLE ${tables} CASCADE;`;
//     await prisma.$executeRawUnsafe(query);
//   } catch (error) {
//     console.log({ error });
//   }
// }

// export async function dropTestDbAndDisconnect(prisma: PrismaClient) {
//   await prisma.$queryRaw`DROP SCHEMA IF EXISTS \"${process.env
//     .DATABASE_SCHEMA!}\" CASCADE`;

//   await prisma.$disconnect();

//   //@ts-ignore
//   //   await global.__POSTGRES__.stop();
// }

// export function createGraphqlTestClient(url: string, token?: string) {
//   return getSdk(
//     new GraphQLClient(url, {
//       headers: token ? { authorization: `Bearer ${token}` } : undefined,
//     })
//   );
// }
