-- Set admin role for yuto5656@outlook.jp
UPDATE "User" SET role = 'admin' WHERE email = 'yuto5656@outlook.jp';

-- Ensure all other users are 'member' (default)
UPDATE "User" SET role = 'member' WHERE email != 'yuto5656@outlook.jp' AND role IS NULL;
