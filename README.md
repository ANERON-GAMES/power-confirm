# power-confirm

Desired power is not truth. The device reading is truth.

A controller that marks an outlet ON because it sent the command will leave the outlet ON after the command failed. For a load that must not stay on, that is the wrong failure. This step reads the live power bit and decides the next command from that bit.

```js
import { nextPowerAction, retryOff } from "./src/index.js";

const step = nextPowerAction(
  { desiredOn: true, claimOn: true, confirmed: false },
  { readable: true, liveOn: false },
  Date.now()
);
// step.command === "off"
// step.reason === "failed_on_claim"
```

If the desired state is ON and the device is OFF, the next command is ON, and the claim is recorded. If that claim is still ON on the next reading and the device is still OFF, the desired state flips to OFF and the command is OFF. An unreadable reading never becomes a confirmed action. `retryOff` caps the follow-up OFF attempts.

The device protocol stays outside this module. Pass a boolean you already read.

```
node --test
```

MIT. Vadim Gubin.
