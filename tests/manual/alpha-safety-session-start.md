# Manual workflows: Wave 1 safety and session start

## Player stop pose

1. Start a session on a simulator with skeletal tracking.
2. Walk. Raise both arms and cross the wrists above the head. The session continues.
3. Stop walking until the tread command is zero. Hold the same pose for 1.5 seconds.
4. The session ends. The events list shows `PLAYER_STOP_REQUESTED` and the stop source `player_pose`. The deck does not release and emergency stop is not latched.
5. Hold the pose for less than 1.5 seconds. The session continues.

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
