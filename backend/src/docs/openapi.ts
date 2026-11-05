/* OpenAPI 3 description of the REST API (served at /api-docs). */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const ok = (description: string, data: object = { type: 'object' }) => ({
  description,
  ...json({ allOf: [ref('Success'), { type: 'object', properties: { data } }] }),
});
const err = (description: string) => ({ description, ...json(ref('Error')) });
const idParam = (name = 'id') => ({ name, in: 'path', required: true, schema: { type: 'string', format: 'uuid' } });
const secured = [{ bearerAuth: [] }];
const std = { 400: err('Validation error'), 401: err('Unauthorized'), 403: err('Forbidden'), 404: err('Not found') };
const page = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
];

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Healthcare Queue Management API',
    version: '1.0.0',
    description:
      'REST API for appointments, live queues and prescriptions. All responses use `{ success, message, data }` or `{ success: false, message, errorCode }`. ' +
      'Real-time updates are published over Socket.IO (`queue:updated`, `queue:patient-called`, `appointment:updated`).',
  },
  servers: [{ url: '/api' }],
  tags: ['Auth', 'Users', 'Doctors', 'Patients', 'Appointments', 'Queue', 'Prescriptions', 'Dashboard'].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Success: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' }, data: {} } },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'This appointment slot is already booked' },
          errorCode: { type: 'string', example: 'SLOT_ALREADY_BOOKED' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },
      Role: { type: 'string', enum: ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'] },
      AppointmentStatus: { type: 'string', enum: ['CONFIRMED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] },
      QueueEntryStatus: { type: 'string', enum: ['WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED'] },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, email: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' },
          phone: { type: 'string', nullable: true }, role: ref('Role'), isActive: { type: 'boolean' },
          doctorId: { type: 'string', nullable: true }, patientId: { type: 'string', nullable: true },
        },
      },
      AuthResult: { type: 'object', properties: { token: { type: 'string' }, user: ref('User') } },
      Schedule: {
        type: 'object',
        required: ['dayOfWeek', 'startTime', 'endTime'],
        properties: {
          dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, description: '0 = Sunday' },
          startTime: { type: 'string', example: '09:00' }, endTime: { type: 'string', example: '17:00' },
          breakStart: { type: 'string', nullable: true, example: '13:00' }, breakEnd: { type: 'string', nullable: true, example: '14:00' },
          slotDuration: { type: 'integer', example: 30 }, isActive: { type: 'boolean' },
        },
      },
      Doctor: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, specialization: { type: 'string' }, qualifications: { type: 'string' },
          experienceYears: { type: 'integer' }, consultationDuration: { type: 'integer' }, consultationFee: { type: 'string' },
          contactPhone: { type: 'string' }, contactEmail: { type: 'string' }, roomNumber: { type: 'string' }, bio: { type: 'string' },
          user: ref('User'), schedules: { type: 'array', items: ref('Schedule') },
        },
      },
      DoctorInput: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'specialization', 'qualifications'],
        properties: {
          email: { type: 'string' }, password: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, phone: { type: 'string' },
          specialization: { type: 'string' }, qualifications: { type: 'string' }, experienceYears: { type: 'integer' },
          consultationDuration: { type: 'integer' }, consultationFee: { type: 'number' }, contactPhone: { type: 'string' },
          contactEmail: { type: 'string' }, roomNumber: { type: 'string' }, bio: { type: 'string' },
        },
      },
      Slot: { type: 'object', properties: { startTime: { type: 'string', format: 'date-time' }, endTime: { type: 'string', format: 'date-time' }, label: { type: 'string', example: '10:30' } } },
      AvailableSlots: {
        type: 'object',
        properties: {
          doctorId: { type: 'string' }, date: { type: 'string' }, timezone: { type: 'string' }, slotDuration: { type: 'integer' },
          isWorkingDay: { type: 'boolean' }, workingHours: { type: 'object', nullable: true }, slots: { type: 'array', items: ref('Slot') },
        },
      },
      Appointment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, reference: { type: 'string', example: 'APT-1001' }, status: ref('AppointmentStatus'),
          startTime: { type: 'string', format: 'date-time' }, endTime: { type: 'string', format: 'date-time' }, reason: { type: 'string' },
          doctor: ref('Doctor'), patient: { type: 'object' },
          queueEntry: { type: 'object', properties: { id: { type: 'string' }, queueId: { type: 'string' }, tokenNumber: { type: 'integer' }, status: ref('QueueEntryStatus') } },
        },
      },
      QueueSnapshot: {
        type: 'object',
        properties: {
          id: { type: 'string' }, doctorId: { type: 'string' }, queueDate: { type: 'string' }, lastToken: { type: 'integer' },
          doctor: { type: 'object' }, current: { type: 'object', nullable: true }, myEntry: { type: 'object', nullable: true },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' }, tokenNumber: { type: 'integer' }, status: ref('QueueEntryStatus'), position: { type: 'integer', nullable: true },
                peopleAhead: { type: 'integer', nullable: true }, estimatedWaitMinutes: { type: 'integer', nullable: true }, isMine: { type: 'boolean' },
              },
            },
          },
          stats: { type: 'object' },
        },
      },
      PrescriptionItem: {
        type: 'object',
        required: ['medicineName', 'dosage', 'frequency', 'duration'],
        properties: {
          medicineName: { type: 'string', example: 'Amoxicillin' }, dosage: { type: 'string', example: '500 mg' },
          frequency: { type: 'string', example: 'Three times a day' }, duration: { type: 'string', example: '7 days' }, instructions: { type: 'string', example: 'After meals' },
        },
      },
      Prescription: {
        type: 'object',
        properties: {
          id: { type: 'string' }, reference: { type: 'string', example: 'RX-1001' }, diagnosis: { type: 'string' }, notes: { type: 'string' },
          items: { type: 'array', items: ref('PrescriptionItem') }, doctor: { type: 'object' }, patient: { type: 'object' }, appointment: { type: 'object' },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register a patient account',
        requestBody: json({ type: 'object', required: ['email', 'password', 'firstName', 'lastName'], properties: { email: { type: 'string' }, password: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, phone: { type: 'string' }, dateOfBirth: { type: 'string', format: 'date' }, gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER'] } } }),
        responses: { 201: ok('Registered', ref('AuthResult')), 400: std[400], 409: err('Email already in use') },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Log in and receive a JWT',
        requestBody: json({ type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', example: 'patient@hqms.test' }, password: { type: 'string', example: 'Password123' } } }),
        responses: { 200: ok('Logged in', ref('AuthResult')), 401: err('Invalid credentials') },
      },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Current user profile', security: secured, responses: { 200: ok('Profile', ref('User')), 401: std[401] } },
      patch: { tags: ['Auth'], summary: 'Update own name/phone', security: secured, requestBody: json({ type: 'object', properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, phone: { type: 'string' } } }), responses: { 200: ok('Updated', ref('User')), ...std } },
    },
    '/auth/me/password': {
      patch: { tags: ['Auth'], summary: 'Change password', security: secured, requestBody: json({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } } }), responses: { 200: ok('Changed'), ...std } },
    },
    '/users': {
      get: { tags: ['Users'], summary: 'List users (ADMIN)', security: secured, parameters: [...page, { name: 'role', in: 'query', schema: ref('Role') }, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: { 200: ok('Users', { type: 'array', items: ref('User') }), ...std } },
      post: { tags: ['Users'], summary: 'Create admin/receptionist/patient user (ADMIN)', security: secured, requestBody: json({ type: 'object', required: ['email', 'password', 'firstName', 'lastName', 'role'], properties: { email: { type: 'string' }, password: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, phone: { type: 'string' }, role: { type: 'string', enum: ['ADMIN', 'RECEPTIONIST', 'PATIENT'] } } }), responses: { 201: ok('Created', ref('User')), ...std, 409: err('Email in use') } },
    },
    '/users/{id}': {
      patch: { tags: ['Users'], summary: 'Update user / activate / deactivate (ADMIN)', security: secured, parameters: [idParam()], requestBody: json({ type: 'object', properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, phone: { type: 'string' }, isActive: { type: 'boolean' } } }), responses: { 200: ok('Updated', ref('User')), ...std } },
      delete: { tags: ['Users'], summary: 'Deactivate user (ADMIN)', security: secured, parameters: [idParam()], responses: { 200: ok('Deactivated'), ...std } },
    },
    '/doctors': {
      get: { tags: ['Doctors'], summary: 'Browse doctors (public)', parameters: [...page, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'specialization', in: 'query', schema: { type: 'string' } }], responses: { 200: ok('Doctors', { type: 'array', items: ref('Doctor') }) } },
      post: { tags: ['Doctors'], summary: 'Create doctor + login account (ADMIN)', security: secured, requestBody: json(ref('DoctorInput')), responses: { 201: ok('Created', ref('Doctor')), ...std, 409: err('Email in use') } },
    },
    '/doctors/specializations': { get: { tags: ['Doctors'], summary: 'Distinct specializations', responses: { 200: ok('List', { type: 'array', items: { type: 'string' } }) } } },
    '/doctors/{id}': {
      get: { tags: ['Doctors'], summary: 'Doctor details', parameters: [idParam()], responses: { 200: ok('Doctor', ref('Doctor')), 404: std[404] } },
      patch: { tags: ['Doctors'], summary: 'Update doctor (ADMIN or the doctor)', security: secured, parameters: [idParam()], requestBody: json(ref('DoctorInput')), responses: { 200: ok('Updated', ref('Doctor')), ...std } },
      delete: { tags: ['Doctors'], summary: 'Delete (or deactivate if history exists) (ADMIN)', security: secured, parameters: [idParam()], responses: { 200: ok('Removed'), ...std } },
    },
    '/doctors/{id}/schedules': {
      get: { tags: ['Doctors'], summary: 'Weekly schedule', parameters: [idParam()], responses: { 200: ok('Schedules', { type: 'array', items: ref('Schedule') }) } },
      put: { tags: ['Doctors'], summary: 'Replace weekly schedule (ADMIN or the doctor)', security: secured, parameters: [idParam()], requestBody: json({ type: 'object', properties: { schedules: { type: 'array', items: ref('Schedule') } } }), responses: { 200: ok('Updated', { type: 'array', items: ref('Schedule') }), ...std } },
    },
    '/doctors/{id}/time-off': {
      get: { tags: ['Doctors'], summary: 'Upcoming unavailable periods', security: secured, parameters: [idParam()], responses: { 200: ok('Time off') } },
      post: { tags: ['Doctors'], summary: 'Add unavailable period', security: secured, parameters: [idParam()], requestBody: json({ type: 'object', required: ['startTime', 'endTime'], properties: { startTime: { type: 'string', format: 'date-time' }, endTime: { type: 'string', format: 'date-time' }, reason: { type: 'string' } } }), responses: { 201: ok('Created'), ...std, 409: err('Conflicts with confirmed appointments') } },
    },
    '/doctors/{id}/time-off/{timeOffId}': {
      delete: { tags: ['Doctors'], summary: 'Remove unavailable period', security: secured, parameters: [idParam(), idParam('timeOffId')], responses: { 200: ok('Removed'), ...std } },
    },
    '/doctors/{id}/available-slots': {
      get: {
        tags: ['Doctors'], summary: 'Available appointment slots for a date',
        description: 'Generates slots from the working schedule and excludes breaks, time off, active appointments and past times. Sorted chronologically.',
        parameters: [idParam(), { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date', example: '2025-01-31' } }],
        responses: { 200: ok('Slots', ref('AvailableSlots')), 400: std[400], 404: std[404] },
      },
    },
    '/patients': { get: { tags: ['Patients'], summary: 'List patients (staff; doctors see own patients)', security: secured, parameters: [...page, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: { 200: ok('Patients'), ...std } } },
    '/patients/{id}': {
      get: { tags: ['Patients'], summary: 'Patient details', security: secured, parameters: [idParam()], responses: { 200: ok('Patient'), ...std } },
      patch: { tags: ['Patients'], summary: 'Update patient profile (self or staff)', security: secured, parameters: [idParam()], requestBody: json({ type: 'object' }), responses: { 200: ok('Updated'), ...std } },
    },
    '/patients/{id}/appointments': {
      get: { tags: ['Appointments'], summary: "Patient's appointment history", security: secured, parameters: [idParam(), ...page, { name: 'status', in: 'query', schema: ref('AppointmentStatus') }, { name: 'upcoming', in: 'query', schema: { type: 'boolean' } }], responses: { 200: ok('Appointments', { type: 'array', items: ref('Appointment') }), ...std } },
    },
    '/patients/{id}/prescriptions': {
      get: { tags: ['Prescriptions'], summary: "Patient's prescriptions", security: secured, parameters: [idParam(), ...page], responses: { 200: ok('Prescriptions', { type: 'array', items: ref('Prescription') }), ...std } },
    },
    '/appointments': {
      post: {
        tags: ['Appointments'], summary: 'Book an appointment',
        description: 'Patients book for themselves; staff must pass `patientId`. End time = start + doctor slot duration. Returns **409 SLOT_ALREADY_BOOKED** when the slot overlaps an active appointment, guaranteed by a PostgreSQL exclusion constraint even under concurrent requests.',
        security: secured,
        requestBody: json({ type: 'object', required: ['doctorId', 'startTime'], properties: { doctorId: { type: 'string', format: 'uuid' }, patientId: { type: 'string', format: 'uuid' }, startTime: { type: 'string', format: 'date-time' }, reason: { type: 'string' } } }),
        responses: { 201: ok('Appointment booked successfully', ref('Appointment')), ...std, 409: err('Slot already booked / patient double booking / doctor unavailable') },
      },
      get: { tags: ['Appointments'], summary: 'List appointments (scoped by role)', security: secured, parameters: [...page, { name: 'status', in: 'query', schema: ref('AppointmentStatus') }, { name: 'doctorId', in: 'query', schema: { type: 'string' } }, { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'upcoming', in: 'query', schema: { type: 'boolean' } }], responses: { 200: ok('Appointments', { type: 'array', items: ref('Appointment') }), ...std } },
    },
    '/appointments/{id}': { get: { tags: ['Appointments'], summary: 'Appointment details', security: secured, parameters: [idParam()], responses: { 200: ok('Appointment', ref('Appointment')), ...std } } },
    '/appointments/{id}/cancel': {
      patch: { tags: ['Appointments'], summary: 'Cancel (frees the slot, removes queue token)', security: secured, parameters: [idParam()], requestBody: json({ type: 'object', properties: { reason: { type: 'string' } } }), responses: { 200: ok('Cancelled', ref('Appointment')), ...std } },
    },
    '/appointments/{id}/reschedule': {
      patch: { tags: ['Appointments'], summary: 'Reschedule atomically', security: secured, parameters: [idParam()], requestBody: json({ type: 'object', required: ['startTime'], properties: { startTime: { type: 'string', format: 'date-time' } } }), responses: { 200: ok('Rescheduled', ref('Appointment')), ...std, 409: err('New slot already booked') } },
    },
    '/queue/mine': { get: { tags: ['Queue'], summary: "Today's queues the current patient is in", security: secured, responses: { 200: ok('Queues', { type: 'array', items: ref('QueueSnapshot') }) } } },
    '/queue/doctor/{doctorId}': { get: { tags: ['Queue'], summary: "Doctor's queue for a date (default today)", security: secured, parameters: [idParam('doctorId'), { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { 200: ok('Queue', ref('QueueSnapshot')), ...std } } },
    '/queue/{id}': { get: { tags: ['Queue'], summary: 'Queue snapshot (patient names hidden from other patients)', security: secured, parameters: [idParam()], responses: { 200: ok('Queue', ref('QueueSnapshot')), ...std } } },
    '/queue/{id}/call': { post: { tags: ['Queue'], summary: 'Call next waiting patient', security: secured, parameters: [idParam()], responses: { 200: ok('Called (or `called: null` when the queue is empty)'), ...std, 409: err('A patient is already called / in consultation') } } },
    '/queue/{id}/start': { post: { tags: ['Queue'], summary: 'Start consultation for called patient', security: secured, parameters: [idParam()], responses: { 200: ok('Started', ref('QueueSnapshot')), ...std, 409: err('No patient called') } } },
    '/queue/{id}/complete': { post: { tags: ['Queue'], summary: 'Complete current consultation', security: secured, parameters: [idParam()], responses: { 200: ok('Completed', ref('QueueSnapshot')), ...std, 409: err('No active patient') } } },
    '/queue/{id}/skip': { post: { tags: ['Queue'], summary: 'Skip called patient (no-show)', security: secured, parameters: [idParam()], responses: { 200: ok('Skipped', ref('QueueSnapshot')), ...std, 409: err('No patient called') } } },
    '/prescriptions': {
      post: { tags: ['Prescriptions'], summary: 'Create prescription (treating DOCTOR only)', security: secured, requestBody: json({ type: 'object', required: ['appointmentId', 'diagnosis', 'items'], properties: { appointmentId: { type: 'string', format: 'uuid' }, diagnosis: { type: 'string' }, notes: { type: 'string' }, items: { type: 'array', items: ref('PrescriptionItem') } } }), responses: { 201: ok('Created', ref('Prescription')), ...std } },
      get: { tags: ['Prescriptions'], summary: 'List prescriptions (scoped by role)', security: secured, parameters: page, responses: { 200: ok('Prescriptions', { type: 'array', items: ref('Prescription') }), ...std } },
    },
    '/prescriptions/{id}': {
      get: { tags: ['Prescriptions'], summary: 'Prescription details', security: secured, parameters: [idParam()], responses: { 200: ok('Prescription', ref('Prescription')), ...std } },
      patch: { tags: ['Prescriptions'], summary: 'Update (prescribing doctor only)', security: secured, parameters: [idParam()], requestBody: json({ type: 'object', properties: { diagnosis: { type: 'string' }, notes: { type: 'string' }, items: { type: 'array', items: ref('PrescriptionItem') } } }), responses: { 200: ok('Updated', ref('Prescription')), ...std } },
      delete: { tags: ['Prescriptions'], summary: 'Delete (prescribing doctor or admin)', security: secured, parameters: [idParam()], responses: { 200: ok('Deleted'), ...std } },
    },
    '/dashboard/stats': { get: { tags: ['Dashboard'], summary: 'Role-specific dashboard statistics', security: secured, responses: { 200: ok('Stats'), 401: std[401] } } },
  },
};
