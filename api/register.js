import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { device_id, device_name, phone_model } = req.body;
    if (!device_id) return res.status(400).json({ error: 'Missing device_id' });

    // Simpen info device di Redis
    const deviceKey = `device:${device_id}`;
    await redis.hset(deviceKey, {
        target_id: device_id,
        target_name: device_name || 'Unknown',
        phone_model: phone_model || 'Unknown',
        installed_at: new Date().toISOString()
    });

    console.log(`[NEW DEVICE] ${device_id} - ${device_name}`);
    return res.json({ status: 'ok' });
}