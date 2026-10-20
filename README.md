# power-confirm

Desired power is not truth. The device reading is truth.

A controller that marks a device ON because it sent the command will leave the device ON after the command failed. For a load that must not stay on, that is the wrong failure. This module takes the desired bit and the live bit and chooses the next command. A failed ON claim forces the desired state to OFF. An unreadable reading never becomes a confirmation.

The device protocol stays outside the module. Pass a boolean you already read.

## Install

The package is an ES module. It needs Node.js 20 or newer. It has no runtime dependencies. The package name is `@aneron/power-confirm`. It is not published to the npm registry.

Clone this repository and run the tests:

```bash
git clone https://github.com/ANERON-GAMES/power-confirm.git
cd power-confirm
npm install
npm test
```

`npm test` runs `node --test`. `npm run lint` runs ESLint. `npm run format:check` runs Prettier.

Install it as a dependency from the git repository:

```bash
npm install github:ANERON-GAMES/power-confirm
```

```js
import { nextPowerAction, retryOff } from "@aneron/power-confirm";
```

Code in this repository imports the same entry point with `./src/index.js`.

## Usage

A state is the caller's memory of one device. A reading is the latest sample: whether it could be read, and whether the device was ON. `nowMs` is stored and is not interpreted.

```js
import { nextPowerAction, retryOff } from "@aneron/power-confirm";

const wantedOn = nextPowerAction(
  { desiredOn: true, claimOn: false, confirmed: false },
  { readable: true, liveOn: false },
  1000
);
// wantedOn.command === "on"
// wantedOn.reason === "desired_on"
// wantedOn.state.claimOn === true

const alreadyOn = nextPowerAction(
  { desiredOn: true, claimOn: false, confirmed: false },
  { readable: true, liveOn: true },
  2000
);
// alreadyOn.command === null
// alreadyOn.reason === "confirmed"
// alreadyOn.state.confirmed === true
// alreadyOn.state.claimOn === true

const failedClaim = nextPowerAction(
  { desiredOn: true, claimOn: true, confirmed: false },
  { readable: true, liveOn: false },
  3000
);
// failedClaim.command === "off"
// failedClaim.reason === "failed_on_claim"
// failedClaim.state.desiredOn === false

const missed = nextPowerAction(
  { desiredOn: true, claimOn: true, confirmed: false },
  { readable: false, liveOn: null },
  4000
);
// missed.command === null
// missed.reason === undefined
// missed.state.confirmed === false
// missed.state.claimOn === true

const followUp = retryOff(0);
// followUp.command === "off"
// followUp.attempts === 1
// retryOff(3).exhausted === true
```

`wantedOn` is the first ON. The claim is recorded, and nothing is confirmed yet. `alreadyOn` sends nothing, because the device is already ON, and it records both the confirmation and the claim. `failedClaim` is an ON that was claimed and then read OFF: the desire becomes OFF, and the command is OFF. `missed` does not confirm and does not clear the claim. `followUp` is the separate OFF counter. Starting from zero, three calls send OFF. The call that is given `3` is exhausted and sends nothing.

## API reference

Both functions are pure. They do not read the clock, the network, or the filesystem. They do not mutate their arguments. The caller passes `nowMs`.

### Constants

| Export                 | Value | Meaning                                                              |
| ---------------------- | ----- | -------------------------------------------------------------------- |
| `DEFAULT_OFF_ATTEMPTS` | `3`   | The cap `retryOff` uses when `maxAttempts` is `null` or `undefined`. |

### `PowerCommand`

Frozen. The fields and the strings are the same values. `command` is `null` when the step does not ask for a write. `null` is not a field on this object.

| Field | Value   | Meaning                      |
| ----- | ------- | ---------------------------- |
| `On`  | `"on"`  | Tell the device to turn on.  |
| `Off` | `"off"` | Tell the device to turn off. |

### `PowerReason`

Frozen. These are the `reason` strings. An unusable reading omits `reason`.

| Field           | Value               | Command | When                                                                                           |
| --------------- | ------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `FailedOnClaim` | `"failed_on_claim"` | `"off"` | Desired ON, the claim is already ON, and the live bit is OFF. Desire becomes OFF.              |
| `DesiredOn`     | `"desired_on"`      | `"on"`  | Desired ON, the live bit is OFF, and there is no ON claim yet. The claim is recorded.          |
| `DesiredOff`    | `"desired_off"`     | `"off"` | Desired OFF and the live bit is ON.                                                            |
| `Confirmed`     | `"confirmed"`       | `null`  | The reading was usable and none of the command rows matched. The two agreement rows land here. |

### State

`nextPowerAction` returns a shallow copy of `state`. The object passed in is not changed. Fields other than the four below are copied through.

| Field          | Type    | Meaning                                                                                                                                                    |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desiredOn`    | boolean | The power state the caller wants. Only the strict boolean `true` is ON. Only the strict boolean `false` is OFF.                                            |
| `claimOn`      | boolean | `true` after an ON command, and after a confirmed ON. A later OFF reading, while this and `desiredOn` are both `true`, is a failed claim.                  |
| `confirmed`    | boolean | `true` only when the last step accepted the reading and matched no command row. A command, a failed claim, and an unusable reading all leave this `false`. |
| `lastReadAtMs` | number  | The `nowMs` of the last step, including a step that could not use the reading. The module does not read a clock.                                           |

### `nextPowerAction(state, reading, nowMs)`

Choose the next command from the desired bit and one reading.

| Argument  | Type   | Role                                                                                          |
| --------- | ------ | --------------------------------------------------------------------------------------------- |
| `state`   | object | The previous state. A usable reading reads `desiredOn` and `claimOn` from it.                 |
| `reading` | any    | `{ readable, liveOn }` from the caller. A missing or non-object value is an unusable reading. |
| `nowMs`   | any    | Stored as `lastReadAtMs`. It is not validated and it is not compared with anything.           |

`reading`, when it is an object:

| Field      | Type    | Role                                                                                                |
| ---------- | ------- | --------------------------------------------------------------------------------------------------- |
| `readable` | boolean | Strict `true` means the caller got a sample. Any other value means the sample cannot be used.       |
| `liveOn`   | boolean | The device power bit. `null` and `undefined` mean the bit is missing. `true` is ON. `false` is OFF. |

The return value is an action:

| Field     | Type             | Meaning                                                                                              |
| --------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `command` | string or `null` | `PowerCommand.On`, `PowerCommand.Off`, or `null`.                                                    |
| `reason`  | string           | A `PowerReason` string when the reading was usable. The property is absent when the reading was not. |
| `state`   | object           | The next state. Replace the caller's state with this object.                                         |

The checks run in this order. The first match wins.

1. The reading is unusable. That is a missing or falsy `reading`, `readable` not strictly `true`, or `liveOn` of `null` or `undefined`. `command` is `null`. There is no `reason`. `confirmed` is `false`. `desiredOn` and `claimOn` stay as they were. `lastReadAtMs` is `nowMs`.
2. `desiredOn` is `true`, `liveOn` is `false`, and `claimOn` is `true`. `command` is `"off"` and `reason` is `"failed_on_claim"`. The returned `desiredOn` is `false`, the claim is `false`, and `confirmed` is `false`.
3. `desiredOn` is `true` and `liveOn` is `false`. `command` is `"on"` and `reason` is `"desired_on"`. The claim becomes `true`. `desiredOn` stays `true`. `confirmed` is `false`.
4. `desiredOn` is `false` and `liveOn` is `true`. `command` is `"off"` and `reason` is `"desired_off"`. The claim is `false`. `confirmed` is `false`.
5. Anything else. `command` is `null` and `reason` is `"confirmed"`. `confirmed` is `true`. `claimOn` is `true` only when `desiredOn` is strictly `true`. Otherwise `claimOn` is `false`.

Rows 2, 3, and 4 are the only rows that ask for a write. Desired ON with live ON, and desired OFF with live OFF, both take row 5. A `liveOn` value other than `true`, `false`, `null`, or `undefined` is not a missing bit, and it is neither ON nor OFF, so it also takes row 5. Pass a boolean.

A usable reading with a missing `state` throws when the function reads `desiredOn`. An unusable reading does not read `state` and still returns a state object.

`nextPowerAction` does not count retries. While the desire is OFF and the device is ON, every call returns OFF.

### `retryOff(attempts, maxAttempts)`

Count one more OFF write, or stop when the cap is already used.

| Argument      | Type   | Role                                                                                                   |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `attempts`    | number | How many OFF writes have already been counted. See the coercion below.                                 |
| `maxAttempts` | number | The cap. `null` and `undefined` select `DEFAULT_OFF_ATTEMPTS`. `0` is a real cap and allows no writes. |

The used count is `Number(attempts)`. `NaN` and `0` become zero. Every other number is kept, including a negative number and `Infinity`. A numeric string is coerced. Pass a number.

The cap is not coerced. Pass a number, or omit it.

| Condition     | Return value                                               |
| ------------- | ---------------------------------------------------------- |
| `used >= cap` | `{ command: null, attempts: used, exhausted: true }`       |
| otherwise     | `{ command: "off", attempts: used + 1, exhausted: false }` |

Starting from `0` with the default cap, the calls return attempts `1`, `2`, and `3` with command `"off"`. The call that is given `3` is exhausted, keeps `attempts` at `3`, and returns `command: null`. This function does not look at desired state or at a reading.

## Design notes

The module exists so an ON command cannot promote itself into the truth. Sending ON records a claim. The next usable reading either confirms that claim or retires it. Retirement means the desired state becomes OFF and the command is OFF. The load is not left ON on the strength of a write the device did not show.

The failed-claim row is the first command row. A fresh ON is legal only when `claimOn` is not already `true`. That blocks a second ON while the first claim is open. It also blocks an automatic ON when a confirmed ON later reads OFF. Confirmation of ON sets `claimOn` to `true` for that reason. The observed ON is still a claim. If the next usable reading is OFF, the claim has failed. The module does not turn the device on again. A caller that still wants ON after that failure passes a new state with `desiredOn: true` and `claimOn: false`.

`retryOff` is outside that decision. `nextPowerAction` returns OFF on every call for as long as the desire is OFF and the device is ON. It does not count those commands. The caller counts, and the cap lives with the caller. An unbounded follow-up is how one stuck OFF becomes a write loop. Three is the default. Pass another number when three is the wrong budget. Pass `0` to refuse the write before it starts.

An unusable reading is not evidence for either side. It does not confirm, it does not command, and it does not clear a claim. A missing reading, `readable` other than `true`, and a missing live bit are the same outcome. The clock value is still stored, so the caller can see when the miss happened.

Comparisons are strict. `desiredOn` of `1` is not ON. `liveOn` of `0` is not OFF. The module does not coerce those fields, and it does not accept a protocol-specific code. The caller translates the device report into `true` or `false` before the call.

This module does not open a socket, schedule a retry, store state, or name a device. Identity, transport, and persistence stay with the caller.

## Compatibility

Version 1.0.0 keeps `nextPowerAction` and `retryOff`, their argument order, the command strings `"on"` and `"off"`, and the reason strings `"failed_on_claim"`, `"desired_on"`, `"desired_off"`, and `"confirmed"`. The default retry cap is still 3.

`DEFAULT_OFF_ATTEMPTS`, `PowerCommand`, and `PowerReason` are new exports. Compare a result with the string or with the field. They are the same value.

The package metadata no longer sets `private`. For every input the previous functions accepted, the command, the reason, and the returned state fields are unchanged.

## License

Released under the MIT License. The full text is in [LICENSE](LICENSE).
