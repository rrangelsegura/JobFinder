import { createApp } from "./app";
import { startCvExtractionWorker } from "./queue/cvExtractionWorker";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`JobFinder API Gateway listening on port ${PORT}`);
});

const worker = startCvExtractionWorker();
worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`CV extraction job ${job?.id} failed: ${err.message}`);
});
