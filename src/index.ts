import "dotenv/config";
import { startServer } from "./rest-server";

startServer().catch((err) => console.error(err));
