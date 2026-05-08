import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import homeRouter from "./routes/home";
import { logger } from "./lib/logger";

const app: Express = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Gzip all responses — big win for JSON payloads and HTML
app.use(compression());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder (favicon, og-image, etc.)
// When built, __dirname is dist/, so we go up 2 levels to reach public/
app.use(express.static(path.resolve(__dirname, "../../public")));

// Pretty-print all JSON responses automatically (2-space indent)
app.set("json spaces", 2);

// Home page — accessible at root (Render / Vercel) and at /api/ (Replit proxy)
app.use("/", homeRouter);
app.use("/api", router);

export default app;
