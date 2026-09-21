import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const AUTH_TOKEN = process.env.AUTH_TOKEN;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const token = req.headers['x-auth-token'];
    if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

    const { target_id } = req.query;
    
    if (target_id) {
        // Cek 1 device
        const lastPing = await redis.get(`online:${target_id}`);
        const online = lastPing && (Date.now() - parseInt(lastPing)) < 30000;
        return res.json({
            target_id,
            online: !!online,
            last_ping: lastPing ? new Date(parseInt(lastPing)).toLocaleTimeString() : '-'
        });
    }
    
    // Cek semua device
    const keys = await redis.keys('device:*');
    const result = [];
    
    for (const key of keys) {
        const id = key.replace('device:', '');
        const lastPing = await redis.get(`online:${id}`);
        const online = lastPing && (Date.now() - parseInt(lastPing)) < 30000;
        
        result.push({
            target_id: id,
            online: !!online,
            last_ping: lastPing ? new Date(parseInt(lastPing)).toLocaleTimeString() : '-'
        });
    }
    
    return res.json(result);
}
