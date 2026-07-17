import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { modulesRouter } from "./modules";
import { notFoundHandler } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
  }),
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "taskmng-backend",
    message: "Express API is running",
  });
});

app.use("/api", modulesRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
