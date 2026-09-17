import jwt from 'jsonwebtoken';

const COOKIE = 'consist_token';

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function signUser(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

export function setAuthCookie(res, user) {
  res.cookie(COOKIE, signUser(user), cookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: 0 });
}

export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }
}
