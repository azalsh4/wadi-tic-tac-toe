import threading
import time


class Magnetron:
    def __init__(self):
        self.power_level = 0
        self.temperature = 0.0
        self.state = 'Off'
        self._enter_Off()

    def _enter_Off(self):
        self.power_level = 0
        self.temperature = 0.0
        print("[HW] Magnetron disabled")

    def _enter_On(self):
        print(f"[HW] Magnetron enabled at {self.power_level}%")

    def activate(self, power):
        if self.state == 'Off':
            self.power_level = power
            self.state = 'On'
            self._enter_On()

    def deactivate(self):
        if self.state == 'On':
            self.state = 'Off'
            self._enter_Off()


class Timer:
    def __init__(self, oven):
        self.duration = 0
        self.remaining = 0
        self.tick_count = 0
        self.state = 'Inactive'
        self._oven = oven
        self._running = False
        self._thread = None

    def _enter_Inactive(self):
        self.remaining = 0
        self.duration = 0
        self.tick_count = 0

    def _enter_Running(self):
        self._running = True
        self._thread = threading.Thread(target=self._tick_loop, daemon=True)
        self._thread.start()

    def _enter_Expired(self):
        self.remaining = 0
        self.tick_count = 0
        self._oven.timer_expired()

    def _tick_loop(self):
        while self._running:
            time.sleep(1)
            if not self._running:
                break
            if self.remaining > 0:
                self.remaining -= 1
                self.tick_count += 1
                minutes = self.remaining // 60
                seconds = self.remaining % 60
                self._oven.display_msg = f"{minutes}:{seconds:02d}"
                self._oven.cook_time = self.remaining
            else:
                self._running = False
                self.state = 'Expired'
                self._enter_Expired()
                break

    def start(self, duration):
        if self.state == 'Inactive':
            self.duration = duration
            self.remaining = duration
            self.state = 'Running'
            self._enter_Running()

    def pause(self):
        if self.state == 'Running':
            self._running = False
            self.state = 'Paused'

    def resume(self):
        if self.state == 'Paused':
            self.state = 'Running'
            self._enter_Running()

    def cancel(self):
        if self.state in ('Running', 'Paused', 'Expired'):
            self._running = False
            self.state = 'Inactive'
            self._enter_Inactive()


class Door:
    def __init__(self, oven):
        self.interlock_active = True
        self.state = 'Closed'
        self._oven = oven

    def open(self):
        if self.state == 'Closed':
            self.interlock_active = False
            self.state = 'Open'
            self._oven.door_opened()

    def close(self):
        if self.state == 'Open':
            self.interlock_active = True
            self.state = 'Closed'
            self._oven.door_closed()


class MicrowaveOven:
    def __init__(self):
        self.cook_time = 0
        self.power_level = 0
        self.display_msg = "OFF"
        self.state = 'Off'

        self.magnetron = Magnetron()
        self.timer = Timer(self)
        self.door = Door(self)

    # --- Entry actions ---

    def _enter_Off(self):
        self.display_msg = "OFF"
        self.cook_time = 0
        self.power_level = 0
        self.magnetron.deactivate()
        self.timer.cancel()

    def _enter_Idle(self):
        self.display_msg = "0:00"
        self.cook_time = 0
        self.door.interlock_active = True

    def _enter_Door_Open(self):
        self.display_msg = "DOOR OPEN"
        self.timer.cancel()
        self.magnetron.deactivate()
        self.door.interlock_active = False

    def _enter_Cooking(self):
        self.display_msg = "COOKING"
        if self.timer.state == 'Paused':
            self.timer.resume()
        else:
            self.timer.start(self.cook_time)
        self.magnetron.activate(self.power_level)

    def _enter_Paused(self):
        self.display_msg = "PAUSED - CLOSE DOOR"
        self.timer.pause()
        self.magnetron.deactivate()

    def _enter_Done(self):
        self.display_msg = "DONE!"
        self.cook_time = 0
        self.magnetron.deactivate()
        print("[BEEPER] Beep! Beep! Beep!")

    # --- Events ---

    def power_on(self):
        if self.state == 'Off':
            self.state = 'Idle'
            self._enter_Idle()

    def power_off(self):
        if self.state == 'Idle':
            self.state = 'Off'
            self._enter_Off()

    def door_opened(self):
        if self.state == 'Idle':
            self.state = 'Door_Open'
            self._enter_Door_Open()
        elif self.state == 'Cooking':
            self.state = 'Paused'
            self._enter_Paused()

    def door_closed(self):
        if self.state == 'Door_Open':
            self.state = 'Idle'
            self._enter_Idle()
        elif self.state == 'Paused':
            self.state = 'Cooking'
            self._enter_Cooking()

    def start_cooking(self, cook_time, power_level=100):
        if self.state == 'Idle':
            self.cook_time = cook_time
            self.power_level = power_level
            self.state = 'Cooking'
            self._enter_Cooking()

    def timer_expired(self):
        if self.state == 'Cooking':
            self.state = 'Done'
            self._enter_Done()

    def cancel(self):
        if self.state in ('Cooking', 'Paused'):
            self.timer.cancel()
            self.state = 'Idle'
            self._enter_Idle()

    def acknowledge_done(self):
        if self.state == 'Done':
            self.state = 'Idle'
            self._enter_Idle()

    def status(self):
        print(f"\n{'='*30}")
        print(f"  Display:   {self.display_msg}")
        print(f"  Oven:      {self.state}")
        print(f"  Door:      {self.door.state}")
        print(f"  Timer:     {self.timer.state} ({self.timer.remaining}s left)")
        print(f"  Magnetron: {self.magnetron.state} ({self.magnetron.power_level}%)")
        print(f"{'='*30}\n")


# --- Simulation ---

if __name__ == '__main__':
    oven = MicrowaveOven()

    print("\n>> Power on")
    oven.power_on()
    oven.status()

    print(">> Start cooking 6 seconds at 80% power")
    oven.start_cooking(cook_time=6, power_level=80)
    oven.status()

    print(">> Wait 2 seconds...")
    time.sleep(2)
    oven.status()

    print(">> Open door mid-cook (pauses)")
    oven.door.open()
    oven.status()

    print(">> Close door (resumes)")
    oven.door.close()
    oven.status()

    print(">> Waiting for timer to finish...")
    time.sleep(6)
    oven.status()

    print(">> Acknowledge done")
    oven.acknowledge_done()
    oven.status()
