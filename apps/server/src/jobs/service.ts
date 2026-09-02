import type { Job, JobCleanupResponse, JobError } from "@maptoy/contracts";
import type { JobRepository } from "../layers/repository.js";
import { JobNotFoundError, JobStateError } from "./errors.js";

export interface JobController {
  readonly type: Job["type"];
  pause(id: string): Job;
  resume(id: string): Job;
  cancel(id: string): Job;
  retry?(id: string): Job;
}

export class JobService {
  private readonly controllers = new Map<Job["type"], JobController>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly jobs: JobRepository,
    private readonly policy: { retentionDays: number },
  ) {}

  register(controller: JobController): void {
    if (this.controllers.has(controller.type)) {
      throw new Error(
        `A Job controller is already registered for ${controller.type}.`,
      );
    }
    this.controllers.set(controller.type, controller);
  }

  initialize(): void {
    this.cleanup();
    this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  shutdown(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  list(): Job[] {
    return this.jobs.list();
  }

  get(id: string): Job {
    const job = this.jobs.get(id);
    if (job === undefined) throw new JobNotFoundError();
    return job;
  }

  errors(id: string): JobError[] {
    this.get(id);
    return this.jobs.listErrors(id);
  }

  cleanup(referenceTime = new Date()): JobCleanupResponse {
    const cutoff = new Date(
      referenceTime.getTime() - this.policy.retentionDays * 86_400_000,
    ).toISOString();
    return { deletedJobs: this.jobs.deleteExpired(cutoff), cutoff };
  }

  pause(id: string): Job {
    return this.controller(this.get(id)).pause(id);
  }

  resume(id: string): Job {
    return this.controller(this.get(id)).resume(id);
  }

  cancel(id: string): Job {
    return this.controller(this.get(id)).cancel(id);
  }

  retry(id: string): Job {
    const controller = this.controller(this.get(id));
    if (controller.retry === undefined) {
      throw new JobStateError("This Job type cannot be retried.");
    }
    return controller.retry(id);
  }

  private controller(job: Job): JobController {
    const controller = this.controllers.get(job.type);
    if (controller === undefined) {
      throw new JobStateError(`Job type ${job.type} cannot be controlled.`);
    }
    return controller;
  }
}
