import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../server.ts";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as any, res as any);
}
