export function nextPowerAction(state, reading, nowMs) {
  const live = reading && reading.liveOn;
  const readable = reading && reading.readable === true;
  if (!readable || live == null) {
    return { command: null, state: { ...state, lastReadAtMs: nowMs, confirmed: false } };
  }
  if (state.desiredOn === true && live === false && state.claimOn === true) {
    return {
      command: "off",
      reason: "failed_on_claim",
      state: {
        ...state,
        desiredOn: false,
        claimOn: false,
        confirmed: false,
        lastReadAtMs: nowMs
      }
    };
  }
  if (state.desiredOn === true && live === false) {
    return {
      command: "on",
      reason: "desired_on",
      state: { ...state, claimOn: true, confirmed: false, lastReadAtMs: nowMs }
    };
  }
  if (state.desiredOn === false && live === true) {
    return {
      command: "off",
      reason: "desired_off",
      state: { ...state, claimOn: false, confirmed: false, lastReadAtMs: nowMs }
    };
  }
  return {
    command: null,
    reason: "confirmed",
    state: { ...state, claimOn: state.desiredOn === true, confirmed: true, lastReadAtMs: nowMs }
  };
}

export function retryOff(attempts, maxAttempts) {
  const used = Number(attempts) || 0;
  const cap = maxAttempts == null ? 3 : maxAttempts;
  if (used >= cap) return { command: null, attempts: used, exhausted: true };
  return { command: "off", attempts: used + 1, exhausted: false };
}
