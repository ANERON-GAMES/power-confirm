import assert from "node:assert/strict";
import test from "node:test";
import { nextPowerAction, retryOff } from "../src/index.js";

test("a failed ON claim forces OFF instead of recording success", () => {
  const action = nextPowerAction(
    { desiredOn: true, claimOn: true, confirmed: false },
    { readable: true, liveOn: false },
    1000
  );
  assert.equal(action.command, "off");
  assert.equal(action.reason, "failed_on_claim");
  assert.equal(action.state.desiredOn, false);
  assert.equal(action.state.confirmed, false);
});

test("desired OFF while the device is still ON sends OFF", () => {
  const action = nextPowerAction(
    { desiredOn: false, claimOn: false, confirmed: false },
    { readable: true, liveOn: true },
    1000
  );
  assert.equal(action.command, "off");
  assert.equal(action.reason, "desired_off");
});

test("an unreadable device does not become a completed action", () => {
  const action = nextPowerAction(
    { desiredOn: true, claimOn: false, confirmed: false },
    { readable: false, liveOn: null },
    1000
  );
  assert.equal(action.command, null);
  assert.equal(action.state.confirmed, false);
});

test("agreement is the only confirmed state", () => {
  const action = nextPowerAction(
    { desiredOn: false, claimOn: false, confirmed: false },
    { readable: true, liveOn: false },
    1000
  );
  assert.equal(action.command, null);
  assert.equal(action.reason, "confirmed");
  assert.equal(action.state.confirmed, true);
});

test("OFF retries stop at the cap", () => {
  assert.equal(retryOff(0, 3).command, "off");
  assert.equal(retryOff(2, 3).attempts, 3);
  assert.equal(retryOff(3, 3).exhausted, true);
  assert.equal(retryOff(3, 3).command, null);
});
