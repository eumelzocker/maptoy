export class JobNotFoundError extends Error {
  readonly code = "JOB_NOT_FOUND";
  readonly statusCode = 404;

  constructor() {
    super("The requested job does not exist.");
    this.name = "JobNotFoundError";
  }
}

export class JobStateError extends Error {
  readonly code = "JOB_STATE_INVALID";
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = "JobStateError";
  }
}
