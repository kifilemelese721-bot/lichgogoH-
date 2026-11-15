import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db';
import type { RoleName } from '../src/types/lms';

const JWT_SECRET = process.env.JWT_SECRET || 'lich-gogo-hosanna-lms-secret-2026-dev';
const TOKEN_TTL_SECONDS = 60 * 60 * 4; // 4 hours automatic session expiration

export interface AuthUserPayload {
  userId: number;
  email: string;
  fullName: string;
  role: RoleName;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUserPayload;
}

export function signAuthToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyAuthToken(token: string): AuthUserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
  } catch {
    return null;
  }
}

export function getUserPermissions(roleName: string): string[] {
  const rows = db
    .prepare(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = ?`,
    )
    .all(roleName) as Array<{ code: string }>;
  return rows.map((r) => r.code);
}

export function parseCookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === 'lgbs_token') {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const cookieToken = parseCookieToken(req.headers.cookie);
  const token = bearerToken || cookieToken;

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const decoded = verifyAuthToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  // Re-verify active status in database
  const dbUser = db
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.status, r.name as role_name
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
    )
    .get(decoded.userId) as
    | { id: number; full_name: string; email: string; status: string; role_name: RoleName }
    | undefined;

  if (!dbUser || dbUser.status !== 'active') {
    res.status(403).json({ error: 'Account is inactive or unavailable.' });
    return;
  }

  req.authUser = {
    userId: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.full_name,
    role: dbUser.role_name,
    permissions: getUserPermissions(dbUser.role_name),
  };

  next();
}

export function requireRole(...allowedRoles: RoleName[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      logAudit(
        req.authUser.userId,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'ROUTE',
        req.originalUrl,
        `Role ${req.authUser.role} denied access; required one of [${allowedRoles.join(', ')}]`,
        req.ip || '',
      );
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}

export function logAudit(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: string | number = '',
  details = '',
  ipAddress = '',
): void {
  try {
    db.prepare(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(userId, action, entityType, String(entityId), details, ipAddress);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export function sanitizeText(value: unknown, maxLen = 2000): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, maxLen);
}
