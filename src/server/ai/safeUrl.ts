/**
 * SSRF Protection for outbound AI provider HTTP requests.
 * Validates that user-supplied endpoints target legitimate, public services
 * and cannot probe internal cloud metadata, private RFC1918 networks, or loopback interfaces.
 */

function isIpv4InCidr(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [b0, b1] = parts;
  // 0.0.0.0/8
  if (b0 === 0) return true;
  // 10.0.0.0/8
  if (b0 === 10) return true;
  // 127.0.0.0/8
  if (b0 === 127) return true;
  // 169.254.0.0/16
  if (b0 === 169 && b1 === 254) return true;
  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  // 192.168.0.0/16
  if (b0 === 192 && b1 === 168) return true;
  return false;
}

/**
 * Validates that rawUrl is a safe, non-internal, non-loopback HTTP/HTTPS endpoint.
 * Throws an Error with a safe message if the endpoint is prohibited.
 */
export function assertSafeEndpoint(rawUrl: string): void {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Invalid endpoint URL: URL is missing or empty.");
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid endpoint URL: unable to parse "${trimmed}".`);
  }

  const isProd = process.env.NODE_ENV === "production";
  if (parsed.protocol !== "https:") {
    if (parsed.protocol !== "http:" || isProd) {
      throw new Error(
        `Insecure endpoint protocol "${parsed.protocol}". Only HTTPS endpoints are permitted${
          isProd ? " in production" : ""
        }.`
      );
    }
  }

  let host = parsed.hostname.toLowerCase().trim();
  // Strip IPv6 enclosing brackets if present
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  // Reject empty hostname
  if (!host) {
    throw new Error("Invalid endpoint URL: empty hostname.");
  }

  // Reject localhost and internal domain names
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal" ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new Error(`Access to internal or loopback host "${host}" is forbidden.`);
  }

  // Reject decimal, octal, or hex raw integer IP forms in hostname (e.g. 2130706433, 0177.0.0.1, 0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) {
    throw new Error("Prohibited IP literal format.");
  }
  if (/\b0[0-7]+(?:\.|$)/.test(host)) {
    throw new Error("Prohibited octal IP literal format.");
  }

  // Check IPv4 literals (standard dotted-quad)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    if (isIpv4InCidr(host)) {
      throw new Error(`Access to private/reserved IP address "${host}" is forbidden.`);
    }
    return;
  }

  // Check IPv6 literals
  if (host.includes(":")) {
    // ::1 loopback
    if (host === "::1" || /^0*(?::0*)*:1$/.test(host)) {
      throw new Error("Access to IPv6 loopback address is forbidden.");
    }
    // :: unspecified
    if (host === "::" || /^0*(?::0*)*$/.test(host)) {
      throw new Error("Access to IPv6 unspecified address is forbidden.");
    }
    // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (/^::ffff:(?:\d{1,3}\.){3}\d{1,3}$/i.test(host)) {
      const ipv4Part = host.replace(/^::ffff:/i, "");
      if (isIpv4InCidr(ipv4Part)) {
        throw new Error(`Access to private IPv4-mapped IPv6 address "${host}" is forbidden.`);
      }
      throw new Error("Access to IPv4-mapped IPv6 address is prohibited.");
    }
    if (host.startsWith("::ffff:") || host.includes(":ffff:")) {
      throw new Error("Access to IPv4-mapped IPv6 address is prohibited.");
    }
    // fc00::/7 Unique Local Addresses (fc00:: through fdff::)
    if (/^f[cd][0-9a-f]{0,2}:/i.test(host)) {
      throw new Error("Access to IPv6 unique local address (fc00::/7) is forbidden.");
    }
    // fe80::/10 Link-Local Addresses (fe80:: through febf::)
    if (/^fe[89ab][0-9a-f]{0,2}:/i.test(host)) {
      throw new Error("Access to IPv6 link-local address (fe80::/10) is forbidden.");
    }
  }
}
