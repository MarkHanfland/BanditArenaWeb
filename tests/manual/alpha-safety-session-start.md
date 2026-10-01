# Manual workflows: Wave 1 safety and session start

## Player stop and pause poses

The stop pose is both arms crossed above the head. The pause pose is both arms raised straight above the head, not crossed. Both count only while the Player is standing still with the tread at zero, after 1.5 seconds of holding.

1. Start a session on a simulator with skeletal tracking.
2. Walk with the arms crossed above the head, then with the arms straight up. The session continues in both cases.
3. Stop walking until the tread command is zero. Raise both arms straight up and hold for 1.5 seconds.
4. The session pauses: the events list shows `PLAYER_PAUSE_REQUESTED`, the status band shows "Player paused" with **Confirm restart**, and the tread stays at zero. Emergency stop is not latched.
5. Lower the arms, stand centred, and select **Confirm restart**. The session resumes.
6. Pause again, then step off the tread. After 3 seconds the session ends with `TREAD_EXIT` and the emergency stop latches.
7. Start a new session. Stand still and cross both wrists above the head for 1.5 seconds.
8. The session ends: the events list shows `PLAYER_STOP_REQUESTED` and the status band says the Player ended the session with the stop pose. The deck does not release and emergency stop is not latched.
9. Hold either pose for less than 1.5 seconds. Nothing happens.

## Fall probability

1. During a session, watch `p_fall` on the user state stream.
2. A brief drop that holds `p_fall` at or above 0.40 for two frames logs `STUMBLE_DETECTED` and does not stop the tread.
3. A drop that holds `p_fall` at or above 0.80 for two frames logs `FALL_DETECTED` and stops the tread, including when stumble never fired.

## Eligibility and cloud

1. Enroll an adult inside 1.5 m to 2.0 m and at most 150 kg, with a date of birth. Start succeeds while the cloud answers.
2. Change the stored height below 1.5 m. Start is refused with "Height is outside this model" and no device session opens.
3. Restore the height. Remove the date of birth. Start is refused because the profile is incomplete.
4. Use a Player under 18 with no guardian authorization. Start is refused.
5. Disconnect the cloud. Start is refused with "cloud unavailable". A previously cached allow does not start the session.
6. With a session already running, drop the cloud. The session continues and ends within 1 hour of the last successful cloud contact if the connection does not return.

## Offline PIN

1. Sign in, then disconnect the cloud within the hour. The Operator PIN still opens local monitoring.
2. The PIN does not start a session.
3. An hour after the last cloud contact, the PIN is rejected.
