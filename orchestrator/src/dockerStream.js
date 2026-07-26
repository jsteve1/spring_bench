/**
 * Strip Docker multiplexed stream headers (8-byte header + payload).
 * Used for container.logs / exec hijacked streams.
 */
export function demuxDockerStream(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length < 8) {
    return buf.toString("utf8");
  }
  // Heuristic: first byte is stream type 1 or 2 and size looks plausible.
  const looksMuxed = (buf[0] === 1 || buf[0] === 2) && buf[1] === 0 && buf[2] === 0 && buf[3] === 0;
  if (!looksMuxed) {
    return buf.toString("utf8");
  }
  const chunks = [];
  let i = 0;
  while (i + 8 <= buf.length) {
    const size = buf.readUInt32BE(i + 4);
    if (size < 0 || i + 8 + size > buf.length) {
      break;
    }
    chunks.push(buf.subarray(i + 8, i + 8 + size));
    i += 8 + size;
  }
  if (chunks.length === 0) {
    return buf.toString("utf8");
  }
  return Buffer.concat(chunks).toString("utf8");
}
