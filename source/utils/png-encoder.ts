import * as zlib from 'zlib';

/**
 * Minimal dependency-free PNG encoder (main process, Node only).
 * Encodes raw RGBA pixel data into a valid PNG Buffer using zlib for IDAT.
 */

const crcTable: number[] = (() => {
    const table = new Array<number>(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf: Buffer): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * GL framebuffers return pixels bottom-up; PNG stores rows top-down.
 * Flip the RGBA buffer vertically.
 */
export function flipVertically(rgba: Uint8Array, width: number, height: number): Uint8Array {
    const rowBytes = width * 4;
    const out = new Uint8Array(width * height * 4);
    for (let row = 0; row < height; row++) {
        const srcRow = height - 1 - row;
        const srcStart = srcRow * rowBytes;
        const dstStart = row * rowBytes;
        for (let i = 0; i < rowBytes; i++) {
            out[dstStart + i] = rgba[srcStart + i];
        }
    }
    return out;
}

/** Encode raw RGBA pixels into a PNG Buffer. */
export function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR: width, height, bit depth 8, color type 6 (RGBA)
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    // Raw scanlines: one filter-byte (0 = None) prefix per row.
    const rowBytes = width * 4;
    const stride = rowBytes + 1;
    const raw = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const rowStart = y * stride;
        raw[rowStart] = 0;
        const srcStart = y * rowBytes;
        for (let i = 0; i < rowBytes; i++) {
            raw[rowStart + 1 + i] = rgba[srcStart + i];
        }
    }

    const idatData = zlib.deflateSync(raw, { level: 6 });

    return Buffer.concat([
        signature,
        makeChunk('IHDR', ihdr),
        makeChunk('IDAT', idatData),
        makeChunk('IEND', Buffer.alloc(0))
    ]);
}

/** Encode raw RGBA pixels into a base64 PNG string. */
export function encodePngBase64(rgba: Uint8Array, width: number, height: number): string {
    return encodePng(rgba, width, height).toString('base64');
}
