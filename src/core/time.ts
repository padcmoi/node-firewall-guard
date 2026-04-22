export function dateNowMs() {
  return Date.now();
}

export function dateISO(ms = dateNowMs()) {
  return new Date(ms).toISOString();
}
