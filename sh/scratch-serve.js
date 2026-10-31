#!/usr/bin/env node
/**
 * 零依赖静态服务器：把 scratch-gui 的 build/ 目录提供出来。
 *
 * 为什么自己写而不是引 serve/http-server：
 *   依赖越少，越不容易在升级 npm 包或换 node 版本时挂；这个场景只需要
 *   「GET 静态文件 + 正确的 Content-Type + SPA 兜底」，40 行就够。
 *
 * 关键点
 *   - 路径必须 resolve 后校验仍在 root 内，防 ../ 穿越
 *   - Content-Type 覆盖 scratch-gui 实际会用到的扩展名（wasm/woff2/svg/json…）
 *   - 找不到的路径回落到 index.html（build 里只有单页入口，深链都能回首页）
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build'));
const PORT = Number(process.argv[3] || process.env.SCRATCH_PORT || 8601);
const HOST = '127.0.0.1';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.wasm': 'application/wasm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain; charset=utf-8',
    '.sb3': 'application/octet-stream',
};

function send(res, code, body, ctype) {
    res.writeHead(code, {
        'Content-Type': ctype,
        'Content-Length': Buffer.byteLength(body),
        // 静态资源带 hash 的可长缓存，html 不缓存（改了能看到新版）
        'Cache-Control': ctype.startsWith('text/html')
            ? 'no-cache'
            : 'public, max-age=3600',
    });
    res.end(body);
}

const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        return res.end('Method Not Allowed');
    }
    let pathname;
    try {
        pathname = decodeURIComponent(url.parse(req.url).pathname || '/');
    } catch (e) {
        return send(res, 400, 'Bad Request', 'text/plain; charset=utf-8');
    }
    if (pathname.endsWith('/')) pathname += 'index.html';

    const target = path.resolve(ROOT, '.' + pathname);
    // 目录穿越防护：resolve 之后必须还在 ROOT 里面
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
        return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    }

    fs.stat(target, (err, st) => {
        if (!err && st.isFile()) {
            const ctype = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
            if (req.method === 'HEAD') {
                res.writeHead(200, { 'Content-Type': ctype, 'Content-Length': st.size });
                return res.end();
            }
            res.writeHead(200, {
                'Content-Type': ctype,
                'Content-Length': st.size,
                'Cache-Control': ctype.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
            });
            return fs.createReadStream(target).pipe(res);
        }
        // 回落到首页（单页应用习惯；也让 /scratch/xxx 之类的深链不至于 404）
        const index = path.join(ROOT, 'index.html');
        fs.readFile(index, (e2, buf) => {
            if (e2) return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
            send(res, 200, buf, 'text/html; charset=utf-8');
        });
    });
});

server.listen(PORT, HOST, () => {
    console.log(`[scratch] serving ${ROOT} at http://${HOST}:${PORT}`);
});
