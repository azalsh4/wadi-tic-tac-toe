# Microwave Oven — xtUML Class Diagram

## Classes

```
+---------------------+  R1 (controls) 1  +---------------------+
|    MicrowaveOven    |-------------------1|        Door         |
+---------------------+                   +---------------------+
| cook_time    : int  |                   | interlock_active    |
| power_level  : int  |                   |   : boolean         |
| display_msg  : str  |                   +---------------------+
+---------------------+                   | State Machine: Door |
| State Machine:      |
|  MicrowaveOven_SM   |  R2 (uses) 1      +---------------------+
+---------------------+-------------------+       Timer         |
         |                                +---------------------+
         | R3 (drives) 1                  | duration   : int    |
         |                                | remaining  : int    |
         1                                | tick_count : int    |
+---------------------+                  +---------------------+
|      Magnetron      |                  | State Machine: Timer|
+---------------------+                  +---------------------+
| power_level  : int  |
| temperature  : real |
+---------------------+
| State Machine:      |
|  Magnetron_SM       |
+---------------------+
```

## Relationships

| ID | Description                          | Multiplicity |
|----|--------------------------------------|--------------|
| R1 | MicrowaveOven **controls** Door      | 1 — 1        |
| R2 | MicrowaveOven **uses** Timer         | 1 — 1        |
| R3 | MicrowaveOven **drives** Magnetron   | 1 — 1        |

## Event Flow Summary

```
Door                    MicrowaveOven            Timer          Magnetron
 |                            |                    |                |
 |--door_opened()------------>|                    |                |
 |                            |--cancel()--------->|                |
 |                            |--deactivate()------------------------->|
 |--door_closed()------------>|                    |                |
 |                            |                    |                |
 |                   [start_cooking received]       |                |
 |                            |--start(duration)-->|                |
 |                            |--activate(power)---------------------->|
 |                            |                    |                |
 |                            |<--timer_expired()--|                |
 |                            |--deactivate()------------------------->|
```

## State Machine Overview

| Class          | States                                          |
|----------------|-------------------------------------------------|
| MicrowaveOven  | Off, Idle, Door_Open, Cooking, Paused, Done     |
| Door           | Closed, Open                                    |
| Timer          | Inactive, Running, Expired                      |
| Magnetron      | Off, On                                         |
