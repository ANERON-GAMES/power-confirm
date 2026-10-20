export const DEFAULT_OFF_ATTEMPTS = 3;

export const PowerCommand = Object.freeze({
  On: "on",
  Off: "off"
});

export const PowerReason = Object.freeze({
  FailedOnClaim: "failed_on_claim",
  DesiredOn: "desired_on",
  DesiredOff: "desired_off",
  Confirmed: "confirmed"
});

export function nextPowerAction(state, reading, nowMs) {
  const liveOn = readLiveBit(reading);
  if (liveOn == null) {
    return {
      command: null,
      state: { ...state, lastReadAtMs: nowMs, confirmed: false }
    };
  }

  if (state.desiredOn === true && liveOn === false && state.claimOn === true) {
    return {
      command: PowerCommand.Off,
      reason: PowerReason.FailedOnClaim,
      state: {
        ...state,
        desiredOn: false,
        claimOn: false,
        confirmed: false,
        lastReadAtMs: nowMs
      }
    };
  }

  if (state.desiredOn === true && liveOn === false) {
    return {
      command: PowerCommand.On,
      reason: PowerReason.DesiredOn,
      state: { ...state, claimOn: true, confirmed: false, lastReadAtMs: nowMs }
    };
  }

  if (state.desiredOn === false && liveOn === true) {
    return {
      command: PowerCommand.Off,
      reason: PowerReason.DesiredOff,
      state: { ...state, claimOn: false, confirmed: false, lastReadAtMs: nowMs }
    };
  }

  return {
    command: null,
    reason: PowerReason.Confirmed,
    state: {
      ...state,
      claimOn: state.desiredOn === true,
      confirmed: true,
      lastReadAtMs: nowMs
    }
  };
}

export function retryOff(attempts, maxAttempts) {
  const used = readUsedAttempts(attempts);
  const cap = maxAttempts == null ? DEFAULT_OFF_ATTEMPTS : maxAttempts;
  if (used >= cap) {
    return { command: null, attempts: used, exhausted: true };
  }

  return { command: PowerCommand.Off, attempts: used + 1, exhausted: false };
}

function isReadable(reading) {
  if (!reading || typeof reading !== "object") {
    return false;
  }
  return reading.readable === true;
}

function readLiveBit(reading) {
  if (!isReadable(reading)) {
    return null;
  }
  return reading.liveOn;
}

function readUsedAttempts(attempts) {
  const numeric = Number(attempts);
  if (!numeric) {
    return 0;
  }
  return numeric;
}
