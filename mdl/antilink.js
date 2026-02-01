/**
 * @command /antilink
 * @category Quản trị
 * @author DxTDz
 * @date 2024-03-15
 * @usage /antilink [on|off|list|add|remove]
 * @description Quản lý chế độ chống link trong nhóm.
 */

const fs = require('fs');
const path = require('path');

// File lưu cấu hình antilink
const CONFIG_FILE = path.join(__dirname, '../antilink_config.json');

// Cấu hình mặc định
const defaultConfig = {
    enabled: false,
    allowedLinks: [],        // Các link được phép (vd: ["t.me", "github.com"])
    whitelistUsers: [],      // User ID được phép gửi link
    whitelistGroups: [],     // Group ID được bỏ qua kiểm tra
    deleteMessage: true,     // Có xóa tin nhắn không
    warnMessage: "⚠️ Bạn không được phép gửi link trong nhóm này!",
    action: "delete"        // delete, mute, warn
};

// Đọc cấu hình từ file
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Lỗi đọc file cấu hình antilink:', error);
    }
    return { ...defaultConfig };
}

// Lưu cấu hình vào file
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('Lỗi lưu file cấu hình antilink:', error);
        return false;
    }
}

// Kiểm tra xem tin nhắn có chứa link không
function containsLink(text) {
    if (!text) return false;
    
    // Regex phát hiện URL
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\.[a-z]{2,}\/[^\s]*)/gi;
    const matches = text.match(urlRegex);
    
    if (!matches) return false;
    
    // Trích xuất domain từ URL
    const domains = matches.map(url => {
        try {
            // Xử lý cả URL đầy đủ và dạng www.example.com
            let domain = url.toLowerCase();
            if (domain.startsWith('http://')) domain = domain.substring(7);
            if (domain.startsWith('https://')) domain = domain.substring(8);
            if (domain.startsWith('www.')) domain = domain.substring(4);
            
            // Lấy phần domain chính (bỏ phần path)
            const slashIndex = domain.indexOf('/');
            if (slashIndex > 0) domain = domain.substring(0, slashIndex);
            
            return domain;
        } catch (error) {
            return null;
        }
    }).filter(domain => domain);
    
    return domains.length > 0 ? domains : false;
}

module.exports = (bot, config) => {
    // Biến lưu cấu hình antilink
    let antilinkConfig = loadConfig();
    
    // ========== LỆNH QUẢN LÝ ANTILINK ==========
    
    // Lệnh chính /antilink
    bot.onText(/\/antilink(?:\s+(.+))?/, (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const params = match[1] ? match[1].toLowerCase().split(' ') : [];
        const action = params[0];
        
        // Chỉ admin mới được dùng lệnh này
        if (userId.toString() !== config.adminId.toString()) {
            return bot.sendMessage(chatId, '❌ Chỉ admin mới được sử dụng lệnh này!');
        }
        
        // Xử lý các lệnh con
        switch(action) {
            case 'on':
                antilinkConfig.enabled = true;
                saveConfig(antilinkConfig);
                bot.sendMessage(chatId, '✅ Đã bật chế độ chống link!');
                break;
                
            case 'off':
                antilinkConfig.enabled = false;
                saveConfig(antilinkConfig);
                bot.sendMessage(chatId, '✅ Đã tắt chế độ chống link!');
                break;
                
            case 'list':
                const enabledStatus = antilinkConfig.enabled ? '🟢 BẬT' : '🔴 TẮT';
                const allowedLinks = antilinkConfig.allowedLinks.length > 0 
                    ? antilinkConfig.allowedLinks.join('\n• ') 
                    : 'Không có';
                const whitelistUsers = antilinkConfig.whitelistUsers.length > 0 
                    ? antilinkConfig.whitelistUsers.join(', ') 
                    : 'Không có';
                    
                bot.sendMessage(chatId, 
                    `📊 **Cấu hình Anti-Link**\n\n` +
                    `• Trạng thái: ${enabledStatus}\n` +
                    `• Hành động: ${antilinkConfig.action}\n` +
                    `• Link được phép:\n• ${allowedLinks}\n` +
                    `• User được phép: ${whitelistUsers}\n` +
                    `• Tin nhắn cảnh báo: ${antilinkConfig.warnMessage}\n\n` +
                    `📝 **Các lệnh:**\n` +
                    `/antilink on - Bật chống link\n` +
                    `/antilink off - Tắt chống link\n` +
                    `/antilink add [link] - Thêm link vào whitelist\n` +
                    `/antilink remove [link] - Xóa link khỏi whitelist\n` +
                    `/antilink useradd [id] - Thêm user vào whitelist\n` +
                    `/antilink userremove [id] - Xóa user khỏi whitelist\n` +
                    `/antilink list - Xem cấu hình hiện tại`,
                    { parse_mode: 'Markdown' }
                );
                break;
                
            case 'add':
                if (params.length < 2) {
                    return bot.sendMessage(chatId, '⚠️ Vui lòng nhập link cần thêm!\nVD: /antilink add t.me');
                }
                
                const linkToAdd = params[1].toLowerCase().replace('https://', '').replace('http://', '');
                if (!antilinkConfig.allowedLinks.includes(linkToAdd)) {
                    antilinkConfig.allowedLinks.push(linkToAdd);
                    saveConfig(antilinkConfig);
                    bot.sendMessage(chatId, `✅ Đã thêm "${linkToAdd}" vào danh sách link được phép!`);
                } else {
                    bot.sendMessage(chatId, 'ℹ️ Link này đã có trong danh sách được phép.');
                }
                break;
                
            case 'remove':
                if (params.length < 2) {
                    return bot.sendMessage(chatId, '⚠️ Vui lòng nhập link cần xóa!\nVD: /antilink remove t.me');
                }
                
                const linkToRemove = params[1].toLowerCase();
                const index = antilinkConfig.allowedLinks.indexOf(linkToRemove);
                if (index > -1) {
                    antilinkConfig.allowedLinks.splice(index, 1);
                    saveConfig(antilinkConfig);
                    bot.sendMessage(chatId, `✅ Đã xóa "${linkToRemove}" khỏi danh sách link được phép!`);
                } else {
                    bot.sendMessage(chatId, '❌ Không tìm thấy link trong danh sách được phép.');
                }
                break;
                
            case 'useradd':
                if (params.length < 2) {
                    return bot.sendMessage(chatId, '⚠️ Vui lòng nhập User ID!\nVD: /antilink useradd 123456789');
                }
                
                const userIdToAdd = params[1];
                if (!antilinkConfig.whitelistUsers.includes(userIdToAdd)) {
                    antilinkConfig.whitelistUsers.push(userIdToAdd);
                    saveConfig(antilinkConfig);
                    bot.sendMessage(chatId, `✅ Đã thêm user ${userIdToAdd} vào whitelist!`);
                } else {
                    bot.sendMessage(chatId, 'ℹ️ User này đã có trong whitelist.');
                }
                break;
                
            case 'userremove':
                if (params.length < 2) {
                    return bot.sendMessage(chatId, '⚠️ Vui lòng nhập User ID!\nVD: /antilink userremove 123456789');
                }
                
                const userIdToRemove = params[1];
                const userIndex = antilinkConfig.whitelistUsers.indexOf(userIdToRemove);
                if (userIndex > -1) {
                    antilinkConfig.whitelistUsers.splice(userIndex, 1);
                    saveConfig(antilinkConfig);
                    bot.sendMessage(chatId, `✅ Đã xóa user ${userIdToRemove} khỏi whitelist!`);
                } else {
                    bot.sendMessage(chatId, '❌ Không tìm thấy user trong whitelist.');
                }
                break;
                
            default:
                // Hiển thị hướng dẫn nếu không có tham số
                bot.sendMessage(chatId,
                    `🛡️ **Anti-Link System**\n\n` +
                    `Chức năng tự động xóa tin nhắn chứa link trong nhóm.\n\n` +
                    `📝 **Các lệnh:**\n` +
                    `/antilink on - Bật chế độ chống link\n` +
                    `/antilink off - Tắt chế độ chống link\n` +
                    `/antilink list - Xem cấu hình hiện tại\n` +
                    `/antilink add [link] - Thêm link vào whitelist\n` +
                    `/antilink remove [link] - Xóa link khỏi whitelist\n` +
                    `/antilink useradd [id] - Thêm user vào whitelist\n` +
                    `/antilink userremove [id] - Xóa user khỏi whitelist\n\n` +
                    `📌 **Ví dụ:**\n` +
                    `/antilink on\n` +
                    `/antilink add t.me\n` +
                    `/antilink add github.com`,
                    { parse_mode: 'Markdown' }
                );
        }
    });
    
    // ========== TỰ ĐỘNG KIỂM TRA TIN NHẮN ==========
    
    bot.on('message', (msg) => {
        // Chỉ kiểm tra nếu antilink đang bật
        if (!antilinkConfig.enabled) return;
        
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const messageId = msg.message_id;
        const text = msg.text || msg.caption || '';
        
        // Bỏ qua nếu không có text
        if (!text.trim()) return;
        
        // Bỏ qua tin nhắn từ admin
        if (userId.toString() === config.adminId.toString()) return;
        
        // Bỏ qua tin nhắn từ user trong whitelist
        if (antilinkConfig.whitelistUsers.includes(userId.toString())) return;
        
        // Kiểm tra xem có chứa link không
        const detectedDomains = containsLink(text);
        
        if (detectedDomains) {
            // Kiểm tra xem link có nằm trong whitelist không
            const hasAllowedLink = detectedDomains.some(domain => {
                return antilinkConfig.allowedLinks.some(allowed => {
                    return domain.includes(allowed) || allowed.includes(domain);
                });
            });
            
            // Nếu không có link nào được phép
            if (!hasAllowedLink) {
                // Ghi log
                console.log(`[ANTILINK] Phát hiện link từ ${userId} trong ${chatId}: ${detectedDomains.join(', ')}`);
                
                // Thực hiện hành động
                switch(antilinkConfig.action) {
                    case 'delete':
                        // Xóa tin nhắn
                        bot.deleteMessage(chatId, messageId).catch(error => {
                            console.error('Lỗi xóa tin nhắn:', error);
                        });
                        
                        // Gửi cảnh báo
                        if (antilinkConfig.deleteMessage) {
                            bot.sendMessage(chatId, 
                                `${antilinkConfig.warnMessage}\n📌 User: [${userId}](tg://user?id=${userId})\n🔗 Link bị chặn: ${detectedDomains.join(', ')}`,
                                { 
                                    parse_mode: 'Markdown',
                                    disable_web_page_preview: true
                                }
                            ).then(warningMsg => {
                                // Tự xóa tin nhắn cảnh báo sau 5 giây
                                setTimeout(() => {
                                    bot.deleteMessage(chatId, warningMsg.message_id).catch(() => {});
                                }, 5000);
                            });
                        }
                        break;
                        
                    case 'warn':
                        // Chỉ cảnh báo, không xóa
                        bot.sendMessage(chatId, 
                            `${antilinkConfig.warnMessage}\n📌 User: [${userId}](tg://user?id=${userId})`,
                            { parse_mode: 'Markdown' }
                        ).then(warningMsg => {
                            setTimeout(() => {
                                bot.deleteMessage(chatId, warningMsg.message_id).catch(() => {});
                            }, 5000);
                        });
                        break;
                        
                    case 'mute':
                        // Xóa tin nhắn và mute user (cần quyền admin của bot)
                        bot.deleteMessage(chatId, messageId).catch(() => {});
                        bot.sendMessage(chatId, 
                            `🚫 User [${userId}](tg://user?id=${userId}) đã bị tạm mute do gửi link!\n🔗 Link: ${detectedDomains.join(', ')}`,
                            { parse_mode: 'Markdown' }
                        );
                        // Ở đây có thể thêm code để restrict user nếu bot có quyền admin
                        break;
                }
            }
        }
    });
    
    // ========== KHỞI TẠO FILE CẤU HÌNH NẾU CHƯA CÓ ==========
    
    if (!fs.existsSync(CONFIG_FILE)) {
        saveConfig(defaultConfig);
        console.log('✅ Đã tạo file cấu hình antilink mặc định');
    }
};
