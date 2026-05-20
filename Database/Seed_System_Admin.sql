USE cloud_pos_db;

INSERT INTO platform_admins (
    full_name,
    username,
    email,
    password_hash,
    status
) VALUES (
    'System Administrator',
    'superadmin',
    'admin@cloudpos.local',
    '$2a$10$r.SVjgFoDo4x31KMYHsbteth1E.1FX3VvYWTKqGTVVpH2fILSd0yq',
    'ACTIVE'
)
ON DUPLICATE KEY UPDATE
    full_name = VALUES(full_name),
    email = VALUES(email),
    password_hash = VALUES(password_hash),
    status = 'ACTIVE';
