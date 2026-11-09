-- Add the EXECUTIVE role (higher-management, read-only executive dashboard).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EXECUTIVE';
