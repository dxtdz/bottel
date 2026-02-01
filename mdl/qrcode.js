/**
 * @command /qrcode
 * @category Tiện ích
 * @author DxTDz
 * @date 2024-03-15
 * @usage /qrcode [text or url]
 * @description Tạo mã QR code từ văn bản hoặc URL.
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

module.exports = (bot, config) => {
    // Tạo thư mục temp nếu chưa có
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Lệnh /qrcode
    bot.onText(/\/qrcode(?:\s+(.+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        const text = match[1];
        
        if (!text) {
            return bot.sendMessage(chatId,
                '📱 **QR Code Generator**\n\n' +
                '📝 **Cách dùng:**\n' +
                '`/qrcode [văn bản hoặc URL]`\n\n' +
                '📌 **Ví dụ:**\n' +
                '• `/qrcode https://github.com/dxtdz`\n' +
                '• `/qrcode Hello World!`\n' +
                '• `/qrcode TEL:0123456789`\n\n' +
                '🎨 **Tùy chọn màu sắc:**\n' +
                '`/qrcode [text] [màu chính] [màu nền]`\n' +
                'Ví dụ: `/qrcode Hello #FF0000 #FFFFFF`',
                { parse_mode: 'Markdown' }
            );
        }
        
        try {
            // Phân tích tham số
            const params = text.split(' ');
            let content = params[0];
            let color = params[1] || '#000000';
            let bgColor = params[2] || '#FFFFFF';
            
            // Kiểm tra nếu là URL, thêm https:// nếu cần
            if (content.match(/^(www\.|[\w-]+\.\w{2,})/) && !content.startsWith('http')) {
                content = 'https://' + content;
            }
            
            // Tạo file tạm
            const filename = `qrcode_${Date.now()}.png`;
            const filepath = path.join(tempDir, filename);
            
            // Tạo QR code
            await QRCode.toFile(filepath, content, {
                color: {
                    dark: color,
                    light: bgColor
                },
                width: 500,
                margin: 2,
                errorCorrectionLevel: 'H'
            });
            
            // Gửi ảnh QR code
            await bot.sendPhoto(chatId, filepath, {
                caption: `✅ **QR Code đã tạo!**\n\n` +
                        `📝 Nội dung: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}\n` +
                        `🎨 Màu: ${color} trên ${bgColor}\n\n` +
                        `📱 Quét thử đi!`,
                parse_mode: 'Markdown'
            });
            
            // Xóa file tạm
            fs.unlinkSync(filepath);
            
        } catch (error) {
            console.error('Lỗi tạo QR code:', error);
            bot.sendMessage(chatId, 
                `❌ Lỗi tạo QR code:\n\`${error.message}\`\n\n` +
                `📌 Thử với nội dung ngắn hơn hoặc màu sắc hợp lệ (hex code).`,
                { parse_mode: 'Markdown' }
            );
        }
    });
    
    // Lệnh /qrscan (giả lập - thực tế cần OCR)
    bot.onText(/\/qrscan/, (msg) => {
        const chatId = msg.chat.id;
        
        bot.sendMessage(chatId,
            '🔍 **QR Code Scanner**\n\n' +
            '📸 Gửi ảnh QR code cho bot để quét!\n\n' +
            '⚠️ *Lưu ý: Chức năng này cần bot có quyền đọc ảnh và xử lý OCR.*',
            { parse_mode: 'Markdown' }
        );
    });
};
