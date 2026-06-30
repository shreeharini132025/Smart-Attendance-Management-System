# Subject-Classroom & Admin Session Scheduling Implementation Tasks

- [x] Database migration & sync checks
  - [x] Run `add_subject_to_classrooms.js` migration
- [x] Backend API enhancements
  - [x] Update `admin.js` classroom APIs to support `subject_id`
  - [x] Add auto-sync logic for faculty subjects and student enrollments on classroom creation/update/enrollment
  - [x] Add session endpoints to `admin.js` (`GET /api/admin/sessions`, `POST /api/admin/sessions`, `DELETE /api/admin/sessions/:id`)
  - [x] Add session configuration endpoint to `faculty.js` (`PUT /api/faculty/sessions/:id/configure`)
- [x] Frontend Admin enhancements
  - [x] Update `Classrooms.js` with Subject select and display
  - [x] Create `AdminSessions.js` page for scheduling sessions
  - [x] Wire up routes in `App.js` and `Layout.js` for Admin Sessions
- [x] Frontend Faculty enhancements
  - [x] Update `Sessions.js` to support session activation with Date, Hour, Start/End Time configuration
