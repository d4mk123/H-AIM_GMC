import { createServer } from 'node:http';

export async function startMockAi(handler) {
  const sockets = new Set();
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        body = {};
      }
      handler({ req, res, body });
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/v1`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        for (const socket of sockets) socket.destroy();
      }),
  };
}

export function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export function completion(message, model = 'test-model') {
  return {
    id: 'cmpl-test',
    model,
    object: 'chat.completion',
    choices: [{ index: 0, message, finish_reason: 'stop' }],
  };
}

export async function withEnv(overrides, work) {
  const saved = {};
  for (const [key, value] of Object.entries(overrides)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await work();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
