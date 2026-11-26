'use strict';

/**
 * Minimal dependency-free PNG encoder for the Cocos Creator 2.x distribution.
 * Runs in the editor main process (Node), encodes raw RGBA pixels into a PNG
 * using zlib for the IDAT chunk.
 */

var zlib = require('zlib');

var crcTable = (function () {
    var table = new Array(256);
    for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
    var typeBuf = Buffer.from(type, 'ascii');
    var len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    var crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * GL framebuffers return pixels bottom-up; PNG stores rows top-down.
 * Flip the RGBA buffer vertically.
 */
function flipVertically(rgba, width, height) {
    var rowBytes = width * 4;
    var out = new Uint8Array(width * height * 4);
    for (var row = 0; row < height; row++) {
        var srcRow = height - 1 - row;
        var srcStart = srcRow * rowBytes;
        var dstStart = row * rowBytes;
        for (var i = 0; i < rowBytes; i++) {
            out[dstStart + i] = rgba[srcStart + i];
        }
    }
    return out;
}

/** Encode raw RGBA pixels into a PNG Buffer. */
function encodePng(rgba, width, height) {
    var signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR: width, height, bit depth 8, color type 6 (RGBA)
    var ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    // Raw scanlines: one filter-byte (0 = None) prefix per row.
    var rowBytes = width * 4;
    var stride = rowBytes + 1;
    var raw = Buffer.alloc(stride * height);
    for (var y = 0; y < height; y++) {
        var rowStart = y * stride;
        raw[rowStart] = 0;
        var srcStart = y * rowBytes;
        for (var i = 0; i < rowBytes; i++) {
            raw[rowStart + 1 + i] = rgba[srcStart + i];
        }
    }

    var idatData = zlib.deflateSync(raw, { level: 6 });

    return Buffer.concat([
        signature,
        makeChunk('IHDR', ihdr),
        makeChunk('IDAT', idatData),
        makeChunk('IEND', Buffer.alloc(0))
    ]);
}

/** Encode raw RGBA pixels into a base64 PNG string. */
function encodePngBase64(rgba, width, height) {
    return encodePng(rgba, width, height).toString('base64');
}

exports.flipVertically = flipVertically;
exports.encodePng = encodePng;
exports.encodePngBase64 = encodePngBase64;
