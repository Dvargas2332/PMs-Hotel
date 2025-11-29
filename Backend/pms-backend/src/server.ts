import app from "./app.js";
import { logger } from "./lib/logger.js";


const port = Number(process.env.PORT || 4000);
app.listen(port, () => logger.info({ port }, "HTTP server listening"));