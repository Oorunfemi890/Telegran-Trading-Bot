// FILE: src/helpers/location.helper.ts (NEW)
// ===================================================

import axios from 'axios';

interface LocationData {
  country?: string;
  city?: string;
  countryCode?: string;
  region?: string;
  timezone?: string;
}

/**
 * Get location data from IP address
 */
export async function getLocationFromIP(ip: string): Promise<LocationData> {
  try {
    // Using ip-api.com free service
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 5000,
    });

    if (response.data.status === 'success') {
      return {
        country: response.data.country,
        city: response.data.city,
        countryCode: response.data.countryCode,
        region: response.data.regionName,
        timezone: response.data.timezone,
      };
    }
  } catch (error) {
    console.error('Failed to get location from IP:', error);
  }

  return {};
}

/**
 * Extract device info from user agent
 */
export function parseUserAgent(userAgent: string): {
  platform?: string;
  browser?: string;
} {
  const deviceInfo: { platform?: string; browser?: string } = {};

  // Detect platform
  if (/Windows/i.test(userAgent)) deviceInfo.platform = 'Windows';
  else if (/Mac OS X/i.test(userAgent)) deviceInfo.platform = 'macOS';
  else if (/Linux/i.test(userAgent)) deviceInfo.platform = 'Linux';
  else if (/Android/i.test(userAgent)) deviceInfo.platform = 'Android';
  else if (/iPhone|iPad|iPod/i.test(userAgent)) deviceInfo.platform = 'iOS';

  // Detect browser
  if (/Chrome/i.test(userAgent) && !/Edge|Edg/i.test(userAgent)) {
    deviceInfo.browser = 'Chrome';
  } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    deviceInfo.browser = 'Safari';
  } else if (/Firefox/i.test(userAgent)) {
    deviceInfo.browser = 'Firefox';
  } else if (/Edge|Edg/i.test(userAgent)) {
    deviceInfo.browser = 'Edge';
  }

  return deviceInfo;
}

/**
 * Get client IP address from request
 */
export function getClientIP(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip ||
    'Unknown'
  );
}