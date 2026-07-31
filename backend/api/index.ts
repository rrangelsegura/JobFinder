import { createApp } from "./app";
import { startCvExtractionWorker } from "./queue/cvExtractionWorker";
import { handleExtractionJobFailure } from "./queue/handleExtractionFailure";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`JobFinder API Gateway listening on port ${PORT}`);
});

const worker = startCvExtractionWorker();
worker.on("failed", (job, err) => {
  handleExtractionJobFailure(job, err).catch((emailErr: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Failed to send extraction-failure acknowledgment email:", emailErr);
  });
});
