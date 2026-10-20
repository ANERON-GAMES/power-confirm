import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OFF_ATTEMPTS,
  PowerCommand,
  PowerReason,
  nextPowerAction,
  retryOff
} from "../src/index.js";

test("a failed ON claim forces OFF instead of recording success", () => {
  const action = nextPowerAction(
    { desiredOn: true, claimOn: true, confirmed: false },
    { readable: true, liveOn: false },
    1000
  );
  assert.equal(action.command, "off");
  assert.equal(action.reason, "failed_on_claim");
  assert.equal(action.state.desiredOn, false);
  assert.equal(action.state.claimOn, false);
  assert.equal(action.state.confirmed, false);
  assert.equal(action.state.lastReadAtMs, 1000);
});

test("desired OFF while the device is still ON sends OFF", () => {
  const action = nextPowerAction(
    { desiredOn: false, claimOn: false, confirmed: false },
    { readable: true, liveOn: true },
    1000
  );
  assert.equal(action.command, "off");
  assert.equal(action.reason, "desired_off");
  assert.equal(action.state.claimOn, false);
  assert.equal(action.state.confirmed, false);
  assert.equal(action.state.lastReadAtMs, 1000);
});

test("an unreadable device does not become a completed action", () => {
  const action = nextPowerAction(
    { desiredOn: true, claimOn: false, confirmed: false },
    { readable: false, liveOn: null },
    1000
  );
  assert.equal(action.command, null);
  assert.equal(Object.hasOwn(action, "reason"), false);
  assert.equal(action.state.desiredOn, true);
  assert.equal(action.state.claimOn, false);
  assert.equal(action.state.confirmed, false);
  assert.equal(action.state.lastReadAtMs, 1000);
});

test("agreement is the only confirmed state", () => {
  const action = nextPowerAction(
    { desiredOn: false, claimOn: false, confirmed: false },
    { readable: true, liveOn: false },
    1000
  );
  assert.equal(action.command, null);
  assert.equal(action.reason, "confirmed");
  assert.equal(action.state.desiredOn, false);
  assert.equal(action.state.claimOn, false);
  assert.equal(action.state.confirmed, true);
  assert.equal(action.state.lastReadAtMs, 1000);
});

test("OFF retries stop at the cap", () => {
  assert.equal(retryOff(0, 3).command, "off");
  assert.equal(retryOff(2, 3).attempts, 3);
  assert.equal(retryOff(3, 3).exhausted, true);
  assert.equal(retryOff(3, 3).command, null);
});

test("desired ON while the device is OFF commands ON", () => {
  const state = { desiredOn: true, claimOn: false, confirmed: false, label: "kept" };
  const reading = { readable: true, liveOn: false };
  const action = nextPowerAction(state, reading, 1000);
  assert.equal(action.command, "on");
  assert.equal(action.reason, "desired_on");
  assert.equal(action.state.desiredOn, true);
  assert.equal(action.state.claimOn, true);
  assert.equal(action.state.confirmed, false);
  assert.equal(action.state.lastReadAtMs, 1000);
  assert.equal(action.state.label, "kept");
  assert.deepEqual(state, {
    desiredOn: true,
    claimOn: false,
    confirmed: false,
    label: "kept"
  });
  assert.deepEqual(reading, { readable: true, liveOn: false });
});

test("desired ON while the device is already ON is confirmed", () => {
  const action = nextPowerAction(
    { desiredOn: true, claimOn: false, confirmed: false },
    { readable: true, liveOn: true },
    1000
  );
  assert.equal(action.command, null);
  assert.equal(action.reason, "confirmed");
  assert.equal(action.state.desiredOn, true);
  assert.equal(action.state.claimOn, true);
  assert.equal(action.state.confirmed, true);
  assert.equal(action.state.lastReadAtMs, 1000);
});

test("an ON claim that the device then shows is confirmed", () => {
  const claimed = nextPowerAction(
    { desiredOn: true, claimOn: false, confirmed: false },
    { readable: true, liveOn: false },
    1000
  );
  const action = nextPowerAction(claimed.state, { readable: true, liveOn: true }, 2000);
  assert.equal(action.command, null);
  assert.equal(action.reason, "confirmed");
  assert.equal(action.state.desiredOn, true);
  assert.equal(action.state.claimOn, true);
  assert.equal(action.state.confirmed, true);
  assert.equal(action.state.lastReadAtMs, 2000);
});

test("a confirmed ON that later reads OFF forces OFF", () => {
  const confirmed = nextPowerAction(
    { desiredOn: true, claimOn: false, confirmed: false },
    { readable: true, liveOn: true },
    1000
  );
  const action = nextPowerAction(confirmed.state, { readable: true, liveOn: false }, 2000);
  assert.equal(action.command, "off");
  assert.equal(action.reason, "failed_on_claim");
  assert.equal(action.state.desiredOn, false);
  assert.equal(action.state.claimOn, false);
  assert.equal(action.state.confirmed, false);
});

test("OFF retries use the named cap when none is passed", () => {
  assert.equal(DEFAULT_OFF_ATTEMPTS, 3);
  assert.equal(retryOff(0).command, "off");
  assert.equal(retryOff(0).attempts, 1);
  assert.equal(retryOff(0).exhausted, false);
  assert.equal(retryOff(DEFAULT_OFF_ATTEMPTS - 1).attempts, DEFAULT_OFF_ATTEMPTS);
  assert.equal(retryOff(DEFAULT_OFF_ATTEMPTS).exhausted, true);
  assert.equal(retryOff(DEFAULT_OFF_ATTEMPTS).command, null);
  assert.equal(retryOff(DEFAULT_OFF_ATTEMPTS).attempts, DEFAULT_OFF_ATTEMPTS);
});

test("command and reason strings are frozen", () => {
  assert.equal(Object.isFrozen(PowerCommand), true);
  assert.equal(Object.isFrozen(PowerReason), true);
  assert.equal(PowerCommand.On, "on");
  assert.equal(PowerCommand.Off, "off");
  assert.equal(PowerReason.FailedOnClaim, "failed_on_claim");
  assert.equal(PowerReason.DesiredOn, "desired_on");
  assert.equal(PowerReason.DesiredOff, "desired_off");
  assert.equal(PowerReason.Confirmed, "confirmed");
});
