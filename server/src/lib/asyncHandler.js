// Express 4 doesn't catch a rejected promise from an async handler on its
// own: an unhandled rejection there just hangs the request. Wrapping every
// async route in this instead of repeating try/catch { next(err) } in each
// one; the existing error-handling middleware in index.js takes it from
// here.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
