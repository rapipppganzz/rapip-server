import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const AUTH_TOKEN = process.env.AUTH_TOKEN;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const token = req.headers['x-auth-token'];
    if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

    const { target_id, command, ...data } = req.body;
    if (!target_id || !command) return res.status(400).json({ error: 'Missing params' });

    // Simpen command di Redis (list per target)
    const cmdKey = `commands:${target_id}`;
    await redis.rpush(cmdKey, JSON.stringify({
        id: Date.now() + Math.random().toString(36).slice(2),
        command,
        data,
        timestamp: Date.now()
    }));
    await redis.expire(cmdKey, 3600); // Expire 1 jam

    console.log(`[CMD] ${command} -> ${target_id}`);
    return res.json({ status: 'ok' });
}