# Manual workflows: commissioning record and emergency patch

Run these against a Fleet Administrator signed in at the console (`https://console.banditarena.com` or local `http://localhost:5173`). The cloud API must be the build that stores `DEVICE#{id}#COMMISSIONING` and gates `POST /updates/emergency-patch`.

## Provision with a commissioning record

1. Open Fleet and choose Provision Device.
2. Clear Golden image. Queue stays disabled. No request is sent.
3. Enter a new compute serial and golden image id `golden-alpha-manual`. Leave self-test at pass.
4. Submit. The console shows the one-time certificate. The device record includes `presetVersion`. A commissioning item exists and is not returned by the device list.
5. Repeat provision for the same serial. The API returns HTTP 409 and does not write a second commissioning record.

## Emergency patch

1. Open Fleet, Emergency patch. Scope stays This device. Enter a target version that is not the device's current firmware and a reason. Submit.
2. Confirm the request is `POST /updates/emergency-patch` with `instanceId`, `targetVersion`, and `reason`, and the response is HTTP 202. `GET /updates/check` for that device shows `emergencyPatchRequested: true`.
3. Repeat with scope This venue. The body has `venueId` and no `fleetScopeConfirmed`. Devices at that venue are queued. A device at another venue is not.
4. Repeat with scope Every device in the tenant. Leave "Patch every device in the tenant" unchecked. Queue patch stays disabled and no request is sent.
5. Check the box and submit. The body has `fleetScopeConfirmed: true` and neither `instanceId` nor `venueId`. The response is HTTP 202.
6. Sign in as Cloud Administrator and repeat step 1. The API returns HTTP 403 `FLEET_ADMIN_REQUIRED` and queues nothing.

## Documentation gaps found with this work

- `07-software-delivery.yaml` described emergency patch and rollback as Field Service Technician or Cloud Administrator and returned HTTP 200. FR-SW-SVC-007 requires Fleet Administrator, HTTP 202, and HTTP 400 when a tenant-wide patch omits `fleetScopeConfirmed`. The spec now matches that route.
- `POST /admin/firmware-push` is still the Cloud Administrator mass-firmware tool from FR-SW-SVC-016. It does not enforce the tenant confirmation. It is not the SVC-007 emergency-patch route.
- `requireProvisioner` still allows Cloud Administrator. FR-SW-SVC-005 says that token receives HTTP 403 on provision. This change does not alter that gate.
- `Bandit/tasks/bandit-software-agent-tasks.md` still says the cloud catalog is FR-SW-SVC-001–018 and that there is no SVC-019. The requirements now include SVC-019 and SVC-020.
- The content download token still does not return a package SHA-256, so the device hash check cannot pass on a live title download.
