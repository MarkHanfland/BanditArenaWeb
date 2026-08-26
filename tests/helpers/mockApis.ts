const demoTenant = {
  tenantId: 'tenant-demo-001',
  name: 'Bandit Demo Operator',
  sessionLimitPerDay: 8,
  schedulingPolicy: 'commercial',
  timezone: 'America/Chicago',
};

const demoVenue = {
  venueId: 'venue-demo-001',
  name: 'Bandit Arena Lab',
  status: 'active',
  timezone: 'America/Chicago',
  ownerCustomerId: 'customer-demo-001',
  ownerOrgId: 'customer-demo-001',
};

const demoCustomer = {
  customerId: 'customer-demo-001',
  name: 'Bandit Lab Facilities',
  status: 'active',
  billingEmail: 'facilities@banditlab.example',
};

export function createCloudFixture() {
  const users = [
    {
      userId: 'user-demo-001',
      name: 'Alex Runner',
      email: 'alex.runner@example.com',
      enrollmentState: 'active',
      ageAttested: true,
      safetyProfile: { heightCm: 178, weightKg: 72, strideCm: 75 },
    },
    {
      userId: 'user-demo-002',
      name: 'Jordan Pending',
      email: 'jordan.pending@example.com',
      enrollmentState: 'pending',
      ageAttested: true,
      safetyProfile: { heightCm: 170, weightKg: 68, strideCm: 70 },
    },
  ];

  const transitions: Record<string, string[]> = {
    pending: ['active', 'revoked'],
    active: ['suspended', 'revoked'],
    suspended: ['active', 'revoked'],
    revoked: [],
  };

  const assignments: Array<{ assignmentId: string; venueId: string; role: string; principal: string }> = [];
  const licenses: Array<Record<string, unknown>> = [
    {
      licenseId: 'lic-demo-001',
      planId: 'venue_pro',
      licenseTier: 'venue_pro',
      status: 'active',
      assignedDeviceId: null,
      expiresAt: null,
    },
  ];
  const reservations = [
    {
      slotId: 'slot-now',
      startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      status: 'booked',
      userId: 'user-demo-001',
      resourceId: 'i1',
    },
    { slotId: 'slot-001', startTime: '2026-06-10T14:00:00.000Z', status: 'available' },
  ];
  const media = [
    {
      mediaId: 'm1',
      name: 'Alpine Trail',
      description: 'Demo',
      cover: 'https://placehold.co/200x120',
      image: 'https://placehold.co/200x120',
      pricePerMinute: 0.1,
      version: 1,
    },
  ];
  const instances = [
    {
      instanceId: 'i1',
      computeSerialNumber: 'BA-SN-001',
      status: 'online',
      firmwareVersion: '1.0',
      updateAvailable: false,
    },
    {
      instanceId: 'i-provisioned',
      computeSerialNumber: 'BA-SN-PROV',
      status: 'provisioned',
      firmwareVersion: '1.0',
    },
  ];
  const maintenance: Record<string, Array<Record<string, unknown>>> = {
    i1: [],
  };
  const tickets: Array<Record<string, unknown>> = [];
  const diagCommands: Array<Record<string, unknown>> = [];
  const orders: Array<Record<string, unknown>> = [];
  const offerings: Array<Record<string, unknown>> = [
    {
      skuId: 'BA-CORE-BUNDLE',
      offeringType: 'primary_system',
      name: 'Bandit Arena Core',
      stream: 'hardware',
      unitPriceUsd: 25000,
      productId: 'bandit-arena-core',
    },
    {
      skuId: 'BA-PRO-BUNDLE',
      offeringType: 'primary_system',
      name: 'Bandit Arena Pro',
      stream: 'hardware',
      unitPriceUsd: 32000,
      productId: 'bandit-arena-pro',
    },
    {
      skuId: 'BA-SPARE-MEMBRANE',
      offeringType: 'spare',
      name: 'Replacement tread membrane',
      stream: 'parts',
      unitPriceUsd: 1600,
      componentId: 'hw-membrane',
      compatibleProductIds: ['product-demo-treadmill', 'bandit-arena-core', 'bandit-arena-pro'],
    },
    {
      skuId: 'BA-ADDON-DOME',
      offeringType: 'addon',
      name: 'Projection dome add-on',
      stream: 'hardware',
      unitPriceUsd: 8500,
      compatibleProductIds: ['bandit-arena-pro'],
      requiresFeatures: ['dome_capable'],
    },
  ];
  const alerts: Array<Record<string, unknown>> = [
    {
      alertId: 'alert-001',
      ruleId: 'rule-device-offline',
      instanceId: 'i1',
      metric: 'device_status',
      severity: 'warning',
      status: 'open',
      message: 'Device i1 is offline',
    },
  ];
  const notifications: Array<Record<string, unknown>> = [];

  return {
    tenant: demoTenant,
    tenants: [demoTenant],
    customers: [demoCustomer],
    venues: [demoVenue],
    users,
    transitions,
    assignments,
    licenses,
    reservations,
    media,
    lastMediaPatch: null as { mediaId: string; body: Record<string, unknown> } | null,
    instances,
    maintenance,
    tickets,
    diagCommands,
    orders,
    offerings,
    alerts,
    notifications,
  };
}

export type CloudFixture = ReturnType<typeof createCloudFixture>;

export async function mockCloudApi(page, fixture: CloudFixture = createCloudFixture()) {
  // SW-089: browser PutObject to presigned S3 URL (not under /api).
  await page.route('https://s3.mock.local/**', async (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 200, body: '' });
    }
    return route.fallback();
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const method = route.request().method();

    const json = (body: object, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/tenants/me') {
      return json({ tenant: fixture.tenant, message: 'Current tenant context' });
    }
    if (path === '/tenants' && method === 'GET') {
      return json({
        tenants: fixture.tenants || [demoTenant],
        message: 'Operator tenant list',
      });
    }
    if (path === '/tenants' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const tenant = {
        tenantId: body.tenantId || `tenant-${Date.now()}`,
        name: body.name || 'New Operator',
        status: 'active',
      };
      fixture.tenants = [...(fixture.tenants || []), tenant];
      return json({ tenant, message: 'Operator tenant created' }, 201);
    }
    if (path === '/customers' && method === 'GET') {
      return json({
        customers: fixture.customers || [demoCustomer],
        message: 'Customer list',
      });
    }
    if (path === '/customers' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const customer = {
        customerId: body.customerId || `customer-${Date.now()}`,
        name: body.name || 'New Customer',
        status: 'active',
      };
      fixture.customers = [...(fixture.customers || []), customer];
      return json({ customer, message: 'Customer created' }, 201);
    }
    if (path === '/venues' && method === 'GET') {
      const customers = fixture.customers || [demoCustomer]
      return json({
        venues: (fixture.venues || [demoVenue]).map((venue) => {
          const ownerCustomerId = venue.ownerCustomerId || venue.ownerOrgId || null
          const owner = customers.find((c) => c.customerId === ownerCustomerId)
          return { ...venue, ownerCustomerId, ownerName: owner?.name || null }
        }),
        message: 'List of venues',
      });
    }
    if (path === '/venues' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const ownerCustomerId = body.ownerCustomerId || null
      const owner = (fixture.customers || []).find((c) => c.customerId === ownerCustomerId)
      const venue = {
        venueId: body.venueId || `venue-${Date.now()}`,
        name: body.name || 'New Venue',
        status: 'active',
        ownerCustomerId,
        ownerName: owner?.name || null,
      };
      fixture.venues = [...(fixture.venues || []), venue];
      return json({ venue, message: 'Venue created' }, 201);
    }
    const venueRoles = path.match(/^\/venues\/([^/]+)\/roles$/);
    if (venueRoles && method === 'GET') {
      const venueId = venueRoles[1];
      return json({
        venueId,
        assignments: fixture.assignments.filter((entry) => entry.venueId === venueId),
        message: 'Venue role assignments',
      });
    }
    if (venueRoles && method === 'POST') {
      const venueId = venueRoles[1];
      const body = route.request().postDataJSON();
      const assignment = {
        assignmentId: `asg-${fixture.assignments.length + 1}`,
        venueId,
        role: body.role,
        principal: body.principal || body.email || body.username,
      };
      fixture.assignments.push(assignment);
      return json({ assignment, message: 'Venue role assigned' });
    }
    if (path === '/users' && method === 'GET') {
      return json({ users: fixture.users, tenant: fixture.tenant, message: 'List of users' });
    }
    if (path === '/users' && method === 'POST') {
      const body = route.request().postDataJSON();
      const user = {
        userId: `user-new-${fixture.users.length + 1}`,
        name: body.name,
        email: body.email || '',
        enrollmentState: body.enrollmentState || 'pending',
        ageAttested: Boolean(body.ageAttested),
        safetyProfile: { heightCm: 170, weightKg: 70, strideCm: 72 },
      };
      fixture.users.push(user);
      return json({ user, message: 'User created' }, 201);
    }
    const enrollment = path.match(/^\/users\/([^/]+)\/enrollment$/);
    if (enrollment && method === 'PATCH') {
      const user = fixture.users.find((entry) => entry.userId === enrollment[1]);
      if (!user) {
        return json({ error: 'User not found' }, 404);
      }
      const next = route.request().postDataJSON()?.enrollmentState;
      const current = user.enrollmentState;
      if (current === next) {
        return json({ message: 'Enrollment state unchanged', user, idempotent: true });
      }
      if (!(fixture.transitions[current] || []).includes(next)) {
        return json({ error: `Cannot transition enrollment from ${current} to ${next}` }, 409);
      }
      user.enrollmentState = next;
      return json({ message: 'Enrollment state updated', from: current, to: next, user });
    }
    const userDetail = path.match(/^\/users\/([^/]+)$/);
    if (userDetail && method === 'GET') {
      const user = fixture.users.find((u) => u.userId === userDetail[1]) || fixture.users[0];
      return json({ user, message: 'User detail' });
    }
    if (/^\/users\/[^/]+\/sessions$/.test(path)) {
      return json({ sessions: [], message: 'User sessions' });
    }
    if (path === '/analytics/summary') {
      return json({
        sessionsCompleted: 5,
        activeDevices: 1,
        enrolledUsers: fixture.users.filter((u) => u.enrollmentState === 'active').length,
        weeklySessionTrend: [1, 2, 3],
        alerts: fixture.alerts.filter((a) => a.status === 'open'),
      });
    }
    if (path === '/alert-rules' && method === 'GET') {
      return json({
        message: 'Alert rules',
        rules: [
          {
            ruleId: 'rule-device-offline',
            name: 'Device offline',
            metric: 'device_status',
            severity: 'warning',
            enabled: true,
          },
        ],
      });
    }
    if (path === '/alerts' && method === 'GET') {
      const status = url.searchParams.get('status');
      let alerts = fixture.alerts;
      if (status) alerts = alerts.filter((a) => a.status === status);
      return json({ message: 'Alerts', alerts });
    }
    {
      const ackMatch = path.match(/^\/alerts\/([^/]+)\/ack$/);
      if (ackMatch && method === 'POST') {
        const alertId = ackMatch[1];
        const alert = fixture.alerts.find((a) => a.alertId === alertId);
        if (!alert) return json({ error: 'Alert not found' }, 404);
        alert.status = 'acknowledged';
        return json({ message: 'Alert acknowledged', alert: { ...alert } });
      }
    }
    if (path === '/notifications' && method === 'GET') {
      return json({ message: 'Notifications', notifications: fixture.notifications });
    }
    if (path === '/media' && method === 'GET') {
      return json({ media: fixture.media });
    }
    if (path === '/media' && method === 'POST') {
      const body = route.request().postDataJSON();
      const item = {
        mediaId: `m-new-${fixture.media.length + 1}`,
        name: body.name,
        description: body.description,
        pricePerMinute: body.pricePerMinute,
        version: 1,
        cover: body.cover || '',
        image: body.image || body.cover || '',
      };
      fixture.media.push(item);
      return json({ media: item, message: 'Content published' }, 201);
    }
    {
      const assetUploadMatch = path.match(/^\/media\/([^/]+)\/asset-upload-token$/);
      if (assetUploadMatch && method === 'POST') {
        const mediaId = assetUploadMatch[1];
        const body = route.request().postDataJSON() || {};
        const assetType = body.assetType === 'demoVideo' ? 'demoVideo' : 'image';
        const ext =
          typeof body.fileName === 'string' && body.fileName.includes('.')
            ? body.fileName.split('.').pop()
            : assetType === 'demoVideo'
              ? 'mp4'
              : 'png';
        const objectKey = `media-assets/${mediaId}/${assetType}/e2e.${ext}`;
        const uploadUrl = `https://s3.mock.local/${objectKey}`;
        return json({
          message: 'Media asset upload token issued',
          uploadToken: 'e2e-upload-token',
          mediaId,
          assetType,
          objectKey,
          uploadUrl,
          contentType: body.contentType || 'application/octet-stream',
          expiresInSeconds: 900,
          issuedAt: new Date().toISOString(),
          source: 's3',
          publicUrl: null,
        });
      }
    }
    {
      const mediaPatchMatch = path.match(/^\/media\/([^/]+)$/);
      if (mediaPatchMatch && method === 'PATCH') {
        const mediaId = mediaPatchMatch[1];
        const body = route.request().postDataJSON() || {};
        const item = fixture.media.find((entry) => entry.mediaId === mediaId);
        if (!item) {
          return json({ error: 'Media not found' }, 404);
        }
        // Capture last PATCH for Playwright assertions (no multi-MB data URLs).
        fixture.lastMediaPatch = { mediaId, body };
        if (body.imageObjectKey != null) {
          item.imageObjectKey = body.imageObjectKey;
          const signed = `https://signed.mock.local/${body.imageObjectKey}`;
          item.image = signed;
          item.cover = signed;
        } else {
          if (body.image != null) item.image = body.image;
          if (body.cover != null) item.cover = body.cover;
        }
        if (body.demoVideoObjectKey != null) {
          item.demoVideoObjectKey = body.demoVideoObjectKey;
          item.demoVideo = `https://signed.mock.local/${body.demoVideoObjectKey}`;
        } else if (body.demoVideo != null) {
          item.demoVideo = body.demoVideo;
        }
        if (body.name != null) item.name = body.name;
        if (body.description != null) item.description = body.description;
        if (body.objectKey != null) item.objectKey = body.objectKey;
        if (body.version != null) item.version = body.version;
        return json({ media: { ...item }, message: 'Media updated' });
      }
    }
    if (path === '/product-instances' && method === 'GET') {
      return json({ instances: fixture.instances });
    }
    if ((path === '/product-instances' || path === '/devices/provision') && method === 'POST') {
      const body = route.request().postDataJSON();
      if (!body.computeSerialNumber) {
        return json({ error: 'computeSerialNumber is required (ASSY-COMPUTE unique serial)' }, 400);
      }
      const instance = {
        instanceId: 'instance-new',
        model: body.model,
        computeSerialNumber: body.computeSerialNumber,
        status: 'provisioned',
        firmwareVersion: '1.2.0-alpha',
        certificateThumbprint: 'abc123',
      };
      fixture.instances.push(instance);
      const oneTimeCredentials = {
        certificatePem: '-----BEGIN BANDIT ALPHA DEVICE CERTIFICATE-----\nDEMO\n-----END BANDIT ALPHA DEVICE CERTIFICATE-----',
        privateKeyPem: '-----BEGIN PRIVATE KEY-----\nDEMO\n-----END PRIVATE KEY-----',
        certificateCn: 'bandit-device-instance-new',
        certificateThumbprint: 'abc123',
        certificateSource: 'alpha-ephemeral',
      };
      return json(
        {
          instance,
          oneTimeCredentials,
          credentials: oneTimeCredentials,
          message: 'Device provisioned',
        },
        201,
      );
    }
    if (path.match(/^\/devices\/[^/]+\/activate$/) && method === 'POST') {
      const id = path.split('/')[2];
      const instance = fixture.instances.find((entry) => entry.instanceId === id);
      if (instance) {
        instance.status = 'active';
      }
      return json({ message: 'Device activated', instance: { instanceId: id, status: 'active' } });
    }
    if (path.match(/^\/devices\/[^/]+\/decommission$/) && method === 'POST') {
      const id = path.split('/')[2];
      return json({ message: 'Device decommissioned', instance: { instanceId: id, status: 'decommissioned' } });
    }
    if (path.match(/^\/devices\/[^/]+\/transfer$/) && method === 'POST') {
      const id = path.split('/')[2];
      return json({ message: 'Device transferred', instance: { instanceId: id, status: 'active' } });
    }
    if (path.match(/^\/devices\/[^/]+\/inventory$/) && method === 'GET') {
      return json({
        inventory: [
          { componentId: 'comp-1', category: 'HW', name: 'Compute', serialNumber: 'BA-SN-001', version: '1.0', status: 'ok' },
        ],
      });
    }
    if (path.match(/^\/devices\/[^/]+\/maintenance$/) && method === 'GET') {
      const id = path.split('/')[2];
      return json({ records: fixture.maintenance[id] || [], maintenance: fixture.maintenance[id] || [] });
    }
    if (path.match(/^\/devices\/[^/]+\/maintenance$/) && method === 'POST') {
      const id = path.split('/')[2];
      const body = route.request().postDataJSON();
      const record = {
        maintenanceId: `mnt-${Date.now()}`,
        type: body.type,
        description: body.description,
        performedAt: new Date().toISOString(),
        componentIds: body.componentIds || (body.componentId ? [body.componentId] : []),
      };
      fixture.maintenance[id] = [...(fixture.maintenance[id] || []), record];
      return json({ record, message: 'Maintenance recorded' }, 201);
    }
    if (path.startsWith('/updates/check')) {
      return json({ updateAvailable: true, latestVersion: '1.1', currentVersion: '1.0' });
    }
    if (path === '/reservations' && method === 'GET') {
      return json({ reservations: fixture.reservations });
    }
    if (path === '/reservations' && method === 'POST') {
      const body = route.request().postDataJSON();
      const slot = fixture.reservations.find((entry) => entry.slotId === body.slotId);
      if (slot) {
        slot.status = 'booked';
      }
      return json({ reservation: { slotId: body.slotId, userId: body.userId, status: 'booked' }, message: 'Reservation confirmed' }, 201);
    }
    if (path === '/entitlements/check') {
      const body = route.request().postDataJSON();
      const user = fixture.users.find((entry) => entry.userId === body.userId);
      const allowed = user?.enrollmentState === 'active';
      return json({ allowed, reason: allowed ? 'active_enrollment' : 'enrollment_not_active' });
    }
    if (path === '/sessions' && method === 'POST') {
      return json({ session: { sessionId: 'session-new', status: 'active' }, message: 'Session created' }, 201);
    }
    if (path === '/notifications/send' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const item = {
        notificationId: `notif-${fixture.notifications.length + 1}`,
        userId: body.userId || 'user-demo-001',
        channel: body.channel || 'email',
        templateId: body.template || 'session_reminder',
        status: 'queued',
      };
      fixture.notifications.unshift(item);
      return json({ notificationId: item.notificationId, status: item.status, message: 'Notification queued' }, 202);
    }
    if (path === '/support/tickets' && method === 'GET') {
      return json({ tickets: fixture.tickets || [], message: 'Support tickets' });
    }
    if (path === '/support/tickets' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const ticket = {
        ticketId: `ticket-${Date.now()}`,
        subject: body.subject,
        status: 'open',
        deviceId: body.deviceId || null,
      };
      fixture.tickets = [...(fixture.tickets || []), ticket];
      return json({ ticket, message: 'Support ticket created' }, 201);
    }
    if (path === '/support/diagnostics/commands' && method === 'GET') {
      return json({ commands: fixture.diagCommands || [], message: 'Diagnostic commands' });
    }
    if (path === '/support/diagnostics/commands' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const command = {
        commandId: `cmd-${Date.now()}`,
        deviceId: body.deviceId,
        command: body.command,
        status: 'queued',
      };
      fixture.diagCommands = [...(fixture.diagCommands || []), command];
      return json({ command, message: 'Diagnostic command queued' }, 202);
    }
    if (path === '/commerce/catalog' && method === 'GET') {
      return json({
        offerings: fixture.offerings,
        message: 'Commerce offerings',
      });
    }
    if (path === '/commerce/compatibility' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const compatible =
        body.skuId !== 'BA-ADDON-DOME' || body.productId === 'bandit-arena-pro';
      return json({
        compatible,
        reasons: compatible ? [] : ['SKU not compatible with model'],
        message: compatible ? 'Offering compatible' : 'Offering not compatible',
      });
    }
    if (path === '/commerce/orders' && method === 'GET') {
      return json({ orders: fixture.orders || [], message: 'Commerce orders' });
    }
    if (path === '/commerce/orders' && method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const line = (body.lines || [])[0] || {};
      if (line.skuId === 'BA-ADDON-DOME' && line.instanceId === 'i1') {
        return json(
          { error: 'SKU not compatible with model', code: 'OFFERING_INCOMPATIBLE', reasons: ['SKU not compatible with model'] },
          409,
        );
      }
      const order = {
        orderId: `ord-${Date.now()}`,
        status: 'submitted',
        stream: 'parts',
        totalUsd: 1600,
        lines: body.lines || [],
      };
      fixture.orders = [...(fixture.orders || []), order];
      return json({ order, message: 'Order created' }, 201);
    }
    if (path === '/billing/revenue-report' && method === 'GET') {
      return json({
        streams: {
          hardware: 57000,
          maintenance: 2500,
          license: 2388,
          content: 0,
          royalty: 0,
          parts: 1600,
          placement: 0,
        },
        totalUsd: 63488,
        orderCount: 5,
        message: 'Revenue report',
      });
    }
    if (path === '/catalog/models' && method === 'GET') {
      return json({
        products: [
          { productId: 'bandit-arena-core', name: 'Bandit Arena Core' },
          { productId: 'bandit-arena-pro', name: 'Bandit Arena Pro' },
          { productId: 'product-demo-treadmill', name: 'Alpha lab' },
        ],
        message: 'Treadmill models',
      });
    }
    if (path.match(/^\/products\/[^/]+\/inventory-preset$/) && method === 'GET') {
      const id = path.split('/')[2];
      return json({
        product: { productId: id },
        inventory: [
          {
            componentId: 'hw-compute',
            category: 'hardware',
            name: 'On-device compute',
            partNumber: 'BA-COMPUTE-MINI',
            fieldReplaceable: true,
          },
          {
            componentId: 'cfg-tread-diameter',
            category: 'configuration',
            name: 'Tread diameter',
            configValue: id.includes('pro') ? '4.2' : '2.9',
            fieldReplaceable: false,
          },
        ],
        message: 'Model inventory preset',
      });
    }
    if (path === '/licenses' && method === 'GET') {
      return json({ licenses: fixture.licenses, message: 'Licenses' });
    }
    if (path === '/licenses' && method === 'POST') {
      const body = route.request().postDataJSON();
      const license = {
        licenseId: `lic-new-${fixture.licenses.length + 1}`,
        planId: body.planId || body.licenseTier || 'venue_pro',
        licenseTier: body.licenseTier || body.planId || 'venue_pro',
        status: 'active',
        assignedDeviceId: body.instanceId || null,
        expiresAt: null,
      };
      fixture.licenses.push(license);
      return json({ license, message: 'License issued' }, 201);
    }
    if (path === '/license-plans' && method === 'GET') {
      return json({
        plans: [
          { planId: 'content_basic', name: 'Content Basic', licenseTier: 'content_basic' },
          { planId: 'venue_pro', name: 'Venue Pro', licenseTier: 'venue_pro' },
        ],
        message: 'License plans',
      });
    }
    const licenseAction = path.match(/^\/licenses\/([^/]+)\/(renew|revoke|assign)$/);
    if (licenseAction && method === 'POST') {
      const license = fixture.licenses.find((entry) => entry.licenseId === licenseAction[1]);
      if (!license) {
        return json({ error: 'License not found' }, 404);
      }
      if (licenseAction[2] === 'revoke') {
        license.status = 'revoked';
        return json({ license, message: 'License revoked' });
      }
      if (licenseAction[2] === 'renew') {
        license.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        return json({ license, message: 'License renewed' });
      }
      const body = route.request().postDataJSON();
      license.assignedDeviceId = body.instanceId;
      return json({ license, message: 'License assigned' });
    }

    return json({ message: 'stub' });
  });
}

export async function mockDeviceApi(page, options: {
  treadmillState?: number
  trackingReady?: boolean
  trackingConfidence?: number
} = {}) {
  let currentSession: {
    active: boolean;
    userId?: string;
    displayName?: string;
    startedAt?: number;
    durationSec?: number;
  } = { active: false, durationSec: 0 };
  const treadmillState = options.treadmillState ?? 5
  const trackingReady = options.trackingReady ?? true
  const trackingConfidence = options.trackingConfidence ?? (trackingReady ? 1 : 0.1);

  const deviceJson = (route, body: object, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  const sessionPayload = () => {
    const tracking = {
      trackingConfidence,
      trackingFresh: trackingReady,
      trackingReady,
      lowConfidenceThreshold: 0.33,
    };
    if (!currentSession.active || !currentSession.startedAt) {
      return { ...currentSession, active: Boolean(currentSession.active), durationSec: 0, ...tracking };
    }
    return {
      ...currentSession,
      durationSec: Math.max(0, Math.floor((Date.now() - currentSession.startedAt) / 1000)),
      ...tracking,
    };
  };

  await page.route('**/config', async (route) => {
    if (route.request().method() === 'PUT') {
      return deviceJson(route, { ok: true });
    }
    return deviceJson(route, {
      tread: { diameter_meters: 3, safety_wall_thickness_meters: 0.5 },
      openxr_runtime: { name: 'SteamVR' },
      services: [],
    });
  });

  await page.route('**/session/current', async (route) => deviceJson(route, sessionPayload()));

  await page.route('**/session/start', async (route) => {
    const body = route.request().postDataJSON() || {};
    currentSession = {
      active: true,
      userId: body.userId,
      displayName: body.displayName || body.userId,
      startedAt: Date.now(),
      durationSec: 0,
    };
    return deviceJson(route, sessionPayload());
  });

  await page.route('**/session/end', async (route) => {
    currentSession = { active: false, durationSec: 0 };
    return deviceJson(route, sessionPayload());
  });

  await page.route('**/auth/info', async (route) =>
    deviceJson(route, {
      auth_enabled: true,
      tenantId: 'tenant-demo-001',
      deviceId: 'instance-demo-001',
      deviceBound: true,
    }),
  );

  await page.route('**/telemetry/current', async (route) =>
    deviceJson(route, {
      tread: { vel: { x: 0, y: 0 }, speed: 0, dir: { x: 0, y: 1 }, tilt: 0, state: treadmillState },
      user: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, facing: { x: 0, y: 1 }, status: 3, dist: 0, speed: 0 },
      avatar: { vel: { x: 0, y: 0 }, pos: { x: 0, y: 0 } },
      ts: Date.now(),
    }),
  );

  await page.route('**/telemetry/stats', async (route) =>
    deviceJson(route, { session: { durationSec: 12 }, avatar: { totalDistance: 4.2 } }),
  );

  await page.route('**/services/status', async (route) =>
    deviceJson(route, {
      services: [
        {
          serviceName: 'OpenXR_Driver',
          secondsSinceLastHeartbeat: 1,
          running: true,
          failed: false,
          restartCount: 0,
          description: 'OpenXR',
          startupSequence: 1,
        },
      ],
    }),
  );

  await page.route('**/events/errors', async (route) => deviceJson(route, { events: [] }));
  await page.route('**/events/safety', async (route) => deviceJson(route, { events: [] }));
  await page.route('**/safety/stop', async (route) => deviceJson(route, { ok: true }));
  await page.route('**/safety/start', async (route) => deviceJson(route, { ok: true }));
}

export async function mockConsoleApis(
  page,
  fixture: CloudFixture = createCloudFixture(),
  deviceOptions: {
    treadmillState?: number
    trackingReady?: boolean
    trackingConfidence?: number
  } = {},
) {
  await mockDeviceApi(page, deviceOptions);
  await mockCloudApi(page, fixture);
  return fixture;
}
