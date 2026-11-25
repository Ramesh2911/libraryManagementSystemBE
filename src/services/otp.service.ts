import { redis } from '../config/redis';

const DEV_ALLOWED_PHONE = '9876543210';
const DEV_OTP = '123456';
const OTP_TTL_SECONDS = 5 * 60; // 5 min
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_SENDS_PER_WINDOW = 3;
const WINDOW_SECONDS = 10 * 60; // 10 min

const normalize = (phone: string) => phone.replace(/\D/g, '');

const otpKey = (phone: string) => `otp:${phone}`;
const cooldownKey = (phone: string) => `otp:cooldown:${phone}`;
const countKey = (phone: string) => `otp:count:${phone}`;

export interface SendOtpResult {
  ok: boolean;
  message: string;
  code?: string;
  retryAfterSeconds?: number;
}

export async function sendOtp(rawPhone: string): Promise<SendOtpResult> {
  const phone = normalize(rawPhone);
  if (phone.length < 10) {
    return { ok: false, message: 'Invalid phone number', code: 'INVALID_PHONE' };
  }

  // Dev mode: only allowlisted phone accepted (SMS gateway later)
  if (phone !== DEV_ALLOWED_PHONE) {
    return {
      ok: false,
      message: 'Phone not allowed for OTP login (dev allowlist: 9876543210)',
      code: 'PHONE_NOT_ALLOWED',
    };
  }

  const cooldown = await redis.ttl(cooldownKey(phone));
  if (cooldown > 0) {
    return {
      ok: false,
      message: 'Please wait before requesting a new OTP',
      code: 'RESEND_COOLDOWN',
      retryAfterSeconds: cooldown,
    };
  }

  const sends = await redis.incr(countKey(phone));
  if (sends === 1) await redis.expire(countKey(phone), WINDOW_SECONDS);
  if (sends > MAX_SENDS_PER_WINDOW) {
    const ttl = await redis.ttl(countKey(phone));
    return {
      ok: false,
      message: 'Too many OTP requests. Try again later.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: ttl > 0 ? ttl : WINDOW_SECONDS,
    };
  }

  // Dev OTP: always 123456 - no SMS sent
  await redis.set(otpKey(phone), DEV_OTP, 'EX', OTP_TTL_SECONDS);
  await redis.set(cooldownKey(phone), '1', 'EX', RESEND_COOLDOWN_SECONDS);

  return {
    ok: true,
    message: 'OTP sent successfully',
    // Dev convenience: expose OTP only in non-production
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: DEV_OTP } : {}),
  };
}

export async function verifyOtp(rawPhone: string, otp: string): Promise<SendOtpResult> {
  const phone = normalize(rawPhone);
  const stored = await redis.get(otpKey(phone));
  if (!stored) {
    return { ok: false, message: 'OTP expired or not requested', code: 'OTP_EXPIRED' };
  }
  if (stored !== normalize(otp)) {
    return { ok: false, message: 'Invalid OTP', code: 'OTP_INVALID' };
  }
  await redis.del(otpKey(phone)); // single-use
  return { ok: true, message: 'OTP verified' };
}
