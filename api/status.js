import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const AUTH_TOKEN = process.env.AUTH_TOKEN;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const token = req.headers['x-auth-token'];
    if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

    const { target_id } = req.query;
    const lastPing = await redis.get(`online:${target_id}`);
    const online = lastPing && (Date.now() - parseInt(lastPing)) < 30000;

    return res.json({
        online: !!online,
        last_ping: lastPing ? new Date(parseInt(lastPing)).toLocaleTimeString() : '-'
    });
}