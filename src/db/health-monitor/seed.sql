-- Demo fixtures adapted from docs/seed/health-monitor/seed.mjs (see docs/plans/v1-plan.md Decision #18).
-- Dates are relative to the seed run time (SQLite date functions), not fixed, so demo data
-- always looks current instead of aging into the past. Re-running this file is always safe:
-- it only ever touches rows where is_demo = 1.

DELETE FROM glucose_measurements WHERE is_demo = 1;
DELETE FROM blood_pressure_measurements WHERE is_demo = 1;
DELETE FROM weight_measurements WHERE is_demo = 1;
DELETE FROM symptom_entries WHERE is_demo = 1;

INSERT INTO glucose_measurements (
  id, created_at, updated_at, is_demo, ignored, reason, measured_at, fasting_value, after_meal_value, note
) VALUES
  ('7ae2110b-02c0-41f1-abbc-91456362625b', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-0 days') || 'Z', 91, NULL, 'Morning check'),
  ('94e6f520-9927-4806-a16a-c06e5ab5ee45', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-2 days') || 'Z', NULL, 128, 'After lunch'),
  ('aebd8960-da1f-46e7-9e9a-97b61cb34dd1', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-7 days') || 'Z', 89, NULL, 'Stable morning'),
  ('d789dd6c-b9e0-4e15-93e4-9ef4a1edeae5', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-9 days') || 'Z', NULL, 132, 'After dinner'),
  ('3463ada9-cf5f-44f0-b9b9-1e3b2d7248fc', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-14 days') || 'Z', 87, NULL, 'Before breakfast'),
  ('43c74b94-804c-4591-963d-128bf9bd8b51', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-16 days') || 'Z', NULL, 124, 'After snack'),
  ('9686353e-c3f3-464e-ac69-cc385da905f7', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-21 days') || 'Z', 90, NULL, 'Morning check'),
  ('11d2d99a-9aee-4ac2-9969-8a6744d50b90', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-23 days') || 'Z', NULL, 130, 'After meal'),
  ('dcdb0705-82f9-4676-a769-ca60996ab337', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-28 days') || 'Z', 92, NULL, 'Morning check'),
  ('24e31dc5-9b13-46bc-b836-65fd72072364', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-30 days') || 'Z', NULL, 126, 'After meal');

INSERT INTO blood_pressure_measurements (
  id, created_at, updated_at, is_demo, ignored, reason, measured_at, systolic, diastolic, pulse, note
) VALUES
  ('19890a28-841b-4ee4-b4f4-7bab98e2aaff', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-0 days') || 'Z', 118, 76, 68, 'Morning check'),
  ('e64dd54c-89fa-42c2-bb2b-1d4d6cb39a30', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-2 days') || 'Z', 122, 80, 71, 'After walk'),
  ('b126ef7e-6eca-4b0a-ab43-f6a3aa42df32', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-7 days') || 'Z', 124, 78, 69, 'Rested'),
  ('9a7288ef-d59c-48ff-8593-30643dad3dc6', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-9 days') || 'Z', 130, 82, 72, 'Evening'),
  ('5cf25238-8695-4854-8753-26db3f251258', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-14 days') || 'Z', 116, 74, 66, 'Calm'),
  ('06df89ef-b298-4873-a3bd-c79834075b6f', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-16 days') || 'Z', 128, 84, 74, 'After stress'),
  ('5a793dce-0126-432a-8902-0107ef1ba19b', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-21 days') || 'Z', 120, 77, 70, 'Morning check'),
  ('d3884300-6bc9-4fbe-9404-1e2859069066', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-23 days') || 'Z', 134, 86, 76, 'After work'),
  ('81db647a-e44c-4e94-b558-d007ebee5057', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-28 days') || 'Z', 117, 73, 67, 'Rested'),
  ('5c0462c8-c09a-46fb-82a9-1e3f5ce16417', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-30 days') || 'Z', 126, 79, 71, 'Morning check');

INSERT INTO weight_measurements (
  id, created_at, updated_at, is_demo, ignored, reason, measured_at, value, note
) VALUES
  ('85c6a361-8e1d-4549-bc6c-1796dbc0960b', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-0 days') || 'Z', 84.6, 'Morning weight'),
  ('c4a566e8-1917-4f7a-bcb1-db0a1fda6a9c', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-2 days') || 'Z', 84.8, 'Morning weight'),
  ('f90bc843-e806-4ed8-814d-2b156d12e68f', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-7 days') || 'Z', 85.0, 'Morning weight'),
  ('82099009-7aeb-421f-8f4b-e6f55f9ef263', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-9 days') || 'Z', 85.1, 'Morning weight'),
  ('f9be485b-1e06-49bc-bfe3-fbf7814bd3b9', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-14 days') || 'Z', 85.3, 'Morning weight'),
  ('d14d7755-a58c-4272-93bd-dbe3687092be', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-16 days') || 'Z', 85.4, 'Morning weight'),
  ('7f5218cf-eddc-430c-bd64-541e47301e48', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-21 days') || 'Z', 85.6, 'Morning weight'),
  ('5d7fed7c-4673-4351-ab9c-cfde110b6f5e', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-23 days') || 'Z', 85.7, 'Morning weight'),
  ('da0118d4-dfae-4149-be7b-dc6d9ee4a794', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-28 days') || 'Z', 85.9, 'Morning weight'),
  ('d5203881-c1fd-4ef8-82fc-1a3ca7dc58f9', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-30 days') || 'Z', 86.0, 'Morning weight');

INSERT INTO symptom_entries (
  id, created_at, updated_at, is_demo, ignored, reason, happened_at, type, intensity, note
) VALUES
  ('57626ed5-ba9b-46cc-a4b7-1b04b340a459', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-0 days') || 'Z', 'bloating', 2, 'Light discomfort'),
  ('9352b0b3-1ddb-4230-9950-60d85322be86', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-2 days') || 'Z', 'headache', 3, 'Short episode'),
  ('51380cf6-a94a-4493-a9fd-8aa92378f5f3', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-7 days') || 'Z', 'bloating', 1, 'Brief note'),
  ('2c5bd8f2-3441-45f9-8093-29e2fd6180b7', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-9 days') || 'Z', 'bloating', 4, 'Managed well'),
  ('7256d99e-1730-41d0-b721-c9e0cecf9820', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-14 days') || 'Z', 'headache', 2, 'Mild issue'),
  ('acba1cc3-bf7b-42d7-9ea0-732f056cb40f', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-16 days') || 'Z', 'stress', 5, 'Noticeable symptom'),
  ('e7b5188e-6d34-40b4-ad36-90c10d4a4af5', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-21 days') || 'Z', 'bloating', 3, 'Short episode'),
  ('28b630ec-7afb-4d2d-ac00-2fbaebec0724', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-23 days') || 'Z', 'headache', 4, 'Evening note'),
  ('cd60be3f-4b9a-44e3-a03d-0a064ef02c43', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-28 days') || 'Z', 'bloating', 2, 'Mild issue'),
  ('22887805-848b-49ec-b6b1-818b20ecd952', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', strftime('%Y-%m-%dT%H:%M:%f', 'now') || 'Z', 1, 0, '', strftime('%Y-%m-%dT%H:%M:%f', 'now', '-30 days') || 'Z', 'bloating', 1, 'Brief note');
