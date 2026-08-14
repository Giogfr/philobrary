import { push, ref, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

const SESSION_KEY = 'pb_visit_logged';

const BOT_RE = /bot|crawler|spider|slurp|bingpreview|headless|curl|wget|python|facebookexternalhit|whatsapp|telegram|discord|linkedinbot|googlebot|seo|ahrefs|semrush/i;

interface DeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  ua: string;
}

function detectDeviceInfo(): DeviceInfo {
  const nav = navigator as any;
  const ua = navigator.userAgent || '';
  const info: DeviceInfo = { browser: '', browserVersion: '', os: '', osVersion: '', device: 'Desktop', ua };

  const uad = nav?.userAgentData;
  if (uad && Array.isArray(uad.brands)) {
    const brands: { brand: string; version: string }[] = uad.brands;
    const known = brands.find((b) => !/not.?a.?brand/i.test(b.brand) && b.version);
    if (known) { info.browser = known.brand; info.browserVersion = known.version; }
    const platform = String(uad.platform || '');
    if (platform) {
      info.os = platform.includes('Mac') ? 'macOS'
        : platform.includes('Win') ? 'Windows'
        : platform.includes('Linux') ? 'Linux'
        : platform.includes('Android') ? 'Android'
        : platform.includes('iPhone') || platform.includes('iPad') ? 'iOS'
        : platform;
    }
    info.device = uad.mobile ? 'Mobile' : info.device;
  }

  if (!info.browser) {
    const browsers: [RegExp, string][] = [
      [/Edg\/([\d.]+)/, 'Edge'],
      [/OPR\/([\d.]+)/, 'Opera'],
      [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
      [/Chrome\/([\d.]+)/, 'Chrome'],
      [/Firefox\/([\d.]+)/, 'Firefox'],
      [/Safari\/([\d.]+)/, 'Safari'],
    ];
    for (const [re, name] of browsers) {
      const m = ua.match(re);
      if (m) { info.browser = name; info.browserVersion = m[1]; break; }
    }
  }

  if (!info.os) {
    const os: [RegExp, string][] = [
      [/iPhone|iPad|iPod/, 'iOS'],
      [/Windows Phone/, 'Windows Phone'],
      [/Windows NT (\d+[.\d]*)/, 'Windows'],
      [/Android (\d+[.\d]*)/, 'Android'],
      [/Mac OS X[ _](\d+[._\d]*)/, 'macOS'],
      [/Linux/, 'Linux'],
    ];
    for (const [re, name] of os) {
      const m = ua.match(re);
      if (m) { info.os = name; if (m[1]) info.osVersion = m[1].replace(/_/g, '.'); break; }
    }
  }

  if (/iPad|Tablet|Android(?!.*Mobile)/.test(ua)) info.device = 'Tablet';
  else if (/Mobi|iPhone|Android/.test(ua)) info.device = 'Mobile';

  return info;
}

/**
 * Records a visit (IP, approximate location, device/browser/OS, referrer)
 * to Firebase /visits, once per browser session. Admin visits are skipped.
 * Never throws — tracking must never break the app.
 */
export async function trackVisit(opts?: { skip?: boolean }): Promise<void> {
  if (opts?.skip) return;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
  } catch { /* storage may be unavailable */ }

  const ua = navigator.userAgent || '';
  if (BOT_RE.test(ua)) return;

  const { browser, browserVersion, os, osVersion, device, ua: rawUa } = detectDeviceInfo();

  let ipData: Record<string, string | number | boolean | undefined> = {};
  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const j = await res.json();
      if (j && !j.error) {
        ipData = {
          ip: j.ip,
          type: j.type,
          continent: j.continent,
          continentCode: j.continent_code,
          country: j.country,
          countryCode: j.country_code,
          region: j.region,
          regionCode: j.region_code,
          city: j.city,
          postal: j.postal,
          lat: j.latitude,
          lon: j.longitude,
          isEu: j.is_eu,
          callingCode: j.calling_code,
          capital: j.capital,
          flagEmoji: j.flag?.emoji,
          flagImg: j.flag?.img,
          asn: j.connection?.asn,
          isp: j.connection?.isp,
          org: j.connection?.org,
          connectionDomain: j.connection?.domain,
          timezoneId: j.timezone?.id,
          timezoneAbbr: j.timezone?.abbr,
          timezoneUtc: j.timezone?.utc,
          timezoneOffset: j.timezone?.offset,
          currentTime: j.timezone?.current_time,
          currency: j.currency,
          currencyCode: j.currency_code,
          currencySymbol: j.currency_symbol,
          anonymous: j.security?.anonymous,
          proxy: j.security?.proxy,
          vpn: j.security?.vpn,
          tor: j.security?.tor,
          hosting: j.security?.hosting,
        };
      }
    }
  } catch { /* geo lookup failed, keep IP only */ }

  if (!ipData.ip) {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      if (res.ok) {
        const j = await res.json();
        if (j?.ip) ipData.ip = j.ip;
      }
    } catch { /* ignore */ }
  }

  const params = new URLSearchParams(window.location.search);
  const campaign = params.get('r') || params.get('ref') || params.get('utm_source') || '';

  const data = {
    at: serverTimestamp(),
    t: Date.now(),
    path: window.location.pathname,
    campaign,
    referrer: document.referrer || '',
    lang: navigator.language || '',
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    ua: rawUa,
    browser,
    browserVersion,
    os,
    osVersion,
    device,
    ...ipData,
  };

  try {
    await push(ref(db, 'visits'), data);
  } catch (e) {
    console.error('Visit tracking failed:', e);
  }

  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch { /* ignore */ }
}
