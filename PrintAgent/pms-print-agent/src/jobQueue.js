export class JobQueue {
  constructor() {
    this._chain = Promise.resolve();
    this._jobs = new Map();
  }

  create(job) {
    const id = `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const record = {
      id,
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...job,
    };
    this._jobs.set(id, record);
    return record;
  }

  get(id) {
    return this._jobs.get(id) || null;
  }

  list() {
    return Array.from(this._jobs.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  run(id, fn) {
    const job = this._jobs.get(id);
    if (!job) return;

    this._chain = this._chain.then(async () => {
      job.status = "running";
      job.updatedAt = new Date().toISOString();
      try {
        await fn();
        job.status = "done";
      } catch (err) {
        job.status = "error";
        job.error = err?.message ? String(err.message) : String(err);
      } finally {
        job.updatedAt = new Date().toISOString();
      }
    });
  }
}

