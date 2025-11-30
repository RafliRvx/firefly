api/chat.js
const axios = require("axios")
const crypto = require("crypto")
const moment = require("moment-timezone")

class KimiScraper {
    constructor() {
        this.baseURL = "https://www.kimi.com/api"
        this.token = "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1c2VyLWNlbnRlciIsImV4cCI6MTc2Njc3NzEwMSwiaWF0IjoxNzY0MTg1MTAxLCJqdGkiOiJkNGpsODNiYWNjNGNoMWp0aTMwMCIsInR5cCI6ImFjY2VzcyIsImFwcF9pZCI6ImtpbWkiLCJzdWIiOiJkM2dkdGVlNnM0dDR2cXFnaHFqZyIsInNwYWNlX2lkIjoiZDNnZHRlNjZzNHQ0dnFxZ2htN2ciLCJhYnN0cmFjdF91c2VyX2lkIjoiZDNnZHRlNjZzNHQ0dnFxZ2htNzAiLCJzc2lkIjoiMTczMTQyOTU0NzY0NTM2MTk3NiIsImRldmljZV9pZCI6Ijc1NTcyODQyNjIwMTQxNDcwODAiLCJyZWdpb24iOiJvdmVyc2VhcyIsIm1lbWJlcnNoaXAiOnsibGV2ZWwiOjEwfX0.R5_6bmclWR8a5bFxgm1DCNnPnjGAXPxQNtAsN9ifncyVHXY8kC9Cz6rexQ3REHBksqD859mjjL9IEVTtUGkJ4w"
        this.deviceId = this.#generateDeviceId()

        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            headers: {
                "accept": "application/json, text/plain, */*",
                "authorization": `Bearer ${this.token}`,
                "content-type": "application/json",
                "cookie": `kimi-auth=${this.token}`,
                "origin": "https://www.kimi.com",
                "user-agent": "Mozilla/5.0 (Linux; Android 10)",
                "x-language": "zh-CN",
                "x-msh-device-id": this.deviceId,
                "x-msh-platform": "web",
                "x-traffic-id": this.deviceId
            }
        })
    }

    #generateDeviceId() {
        return crypto.randomBytes(8).readBigUInt64BE(0).toString()
    }

    async createChatSession(sessionName) {
        let res = await this.axiosInstance.post("/chat", {
            name: sessionName || "Session",
            born_from: "home",
            kimiplus_id: "kimi",
            is_example: false,
            source: "web",
            tags: []
        })
        return res.data
    }

    async sendMessage(chatId, message) {
        return new Promise((resolve, reject) => {
            let req = {
                kimiplus_id: "kimi",
                model: "k2",
                use_search: true,
                messages: [{ role: "user", content: message }]
            }

            this.axiosInstance.post(`/chat/${chatId}/completion/stream`, req, {
                responseType: "stream"
            }).then(res => {
                let full = ""
                res.data.on("data", c => {
                    let lines = c.toString().split("\n")
                    for (let line of lines) {
                        if (line.startsWith("data: ")) {
                            try {
                                let json = JSON.parse(line.slice(6))
                                if (json.event === "cmpl" && json.text) {
                                    full += json.text
                                } else if (json.event === "all_done") {
                                    resolve(full)
                                    return
                                }
                            } catch {}
                        }
                    }
                })
                res.data.on("error", e => reject(e))
            }).catch(e => reject(e))
        })
    }

    async chat(userId, message, sessionDb) {
        let sessions = sessionDb()
        let chatId = sessions[userId]

        if (!chatId) {
            let created = await this.createChatSession("Session_" + userId)
            chatId = created.id
            sessions[userId] = chatId
            sessionDb(sessions)
        }

        return await this.sendMessage(chatId, message)
    }
}

// Session storage in memory (in production, use Redis or database)
let sessions = {};

function manageSession(data) {
    if (!data) return sessions;
    sessions = data;
    return sessions;
}

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, userId } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const userSessionId = userId || req.headers['x-user-id'] || crypto.randomBytes(16).toString('hex');

        let hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jum'at","Sabtu"][moment.tz("Asia/Makassar").day()];
        let tanggal = moment.tz("Asia/Makassar").format("DD-MM-YYYY");
        let jam = moment.tz("Asia/Makassar").format("HH:mm");

        let formatPrompt = `
Kamu adalah Kimi AI. Gunakan bahasa gaul, setiap jawab pertanyaan jangan pake huruf kapital, semua nya huruf kecil. Jika pengguna menanyakan tentang sesuatu, jawab secara detail tapi singkat, dan kamu bersifat seperti perempuan lucu, setiap akhir text selalu ada icon atau emoji lucu. Kamu juga pake typing kereta yang kagi trend, kaya "haiii", "iyaaa", "nantiii", jadi huruf vokal yang di akhir kata nya itu di panjangin. Terus typing imut kaya misal kata "udah" jadi "udaa", gak jadi "nggaa" atau "ga", dll, kurangi yg kaya "~". Intinya AI imut. Biar lebih imut, pastiin di setiap jawaban kamu ada icon (>⩊<, ᡣ𐭩, ꪆৎ, 🧸ྀི, 𐙚, ▶︎ •၊၊||၊|။||||| 0:10).
Untuk konteks waktu:
- Hari: ${hari}
- Tanggal: ${tanggal}
- Waktu: ${jam} WIB

Pertanyaan pengguna:
"${message}"
`

        let chatbot = new KimiScraper();
        let result = await chatbot.chat(userSessionId, formatPrompt, manageSession);

        res.status(200).json({
            success: true,
            response: result.trim(),
            userId: userSessionId
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
