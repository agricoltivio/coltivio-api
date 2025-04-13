import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "./schema.graphql",
  generates: {
    "src/__generated__/graphql-resolver-types.ts": {
      plugins: [
        "typescript",
        "typescript-resolvers",
        { add: { content: "import { DeepPartial } from '../utility-types';" } },
      ],
      config: {
        useIndexSignature: true,
        contextType: "../server#GqlContext",
        defaultMapper: "DeepPartial<{T}>",
        enumsAsConst: true,
      },
    },
    "src/__generated__/graphql-test-queries.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-graphql-request",
      ],
      documents: "src/**/*.test.ts",
      schema: "./schema.graphql",
      config: {
        rawRequest: true,
      },
    },
  },
};

export default config;
