import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const AUTH_TOKEN = process.env.AUTH_TOKEN;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const token = req.headers['x-auth-token'];
    if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

    // Cari semua key device:*
    const keys = await redis.keys('device:*');
    const devices = [];

    for (const key of keys) {
        const device = await redis.hgetall(key);
        if (device) {
            const id = key.replace('device:', '');
            
            // Cek status online dari key online:xxx
            const lastPing = await redis.get(`online:${id}`);
            const isOnline = lastPing && (Date.now() - parseInt(lastPing)) < 30000;
            
            devices.push({
                ...device,
                online: isOnline,
                last_ping: lastPing ? new Date(parseInt(lastPing)).toLocaleTimeString() : '-'
            });
        }
    }

    return res.json(devices);
}
