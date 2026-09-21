import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { target_id, command_id, result } = req.body;
    await redis.set(`result:${target_id}:${command_id}`, JSON.stringify({
        result,
        timestamp: Date.now()
    }), { ex: 3600 });

    console.log(`[REPORT] ${target_id}: ${result}`);
    return res.json({ status: 'ok' });
}