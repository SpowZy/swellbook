import {
  DatesUnavailableError,
  HoldExpiredError,
  NotFoundError,
  ValidationError,
} from "./repo/bookings";

/** Maps engine errors onto honest HTTP responses with human-readable messages. */
export function apiError(err: unknown): Response {
  if (err instanceof ValidationError) {
    return Response.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof NotFoundError) {
    return Response.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof DatesUnavailableError) {
    return Response.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof HoldExpiredError) {
    return Response.json({ error: err.message }, { status: 410 });
  }
  console.error(err);
  return Response.json({ error: "Something went wrong on our side." }, { status: 500 });
}
