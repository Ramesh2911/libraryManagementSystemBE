import { Response } from 'express';

export interface Envelope<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  timestamp: string;
}

export function ok<T>(res: Response, data: T, message = 'OK', status = 200): Response {
  const body: Envelope<T> = {
    success: true,
    statusCode: status,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  return res.status(status).json(body);
}

export function fail(
  res: Response,
  message: string,
  status = 500,
  code?: string
): Response {
  const body: Envelope & { code?: string } = {
    success: false,
    statusCode: status,
    message,
    timestamp: new Date().toISOString(),
  };
  if (code) body.code = code;
  return res.status(status).json(body);
}
